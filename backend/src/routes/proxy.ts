import { Router, Request, Response } from "express";
import {
  getCache, setCache, CACHE_TTL, getGridCacheKey,
  acquireLock, releaseLock, trackMiss, getCacheTTL,
} from "../services/cache";
import { trackGeocodeSearch, trackOverpassCategories, trackTransportMode } from "../services/analytics";
import crypto from "crypto";

const router = Router();

const OVERPASS_URL  = process.env.OVERPASS_URL  || "https://overpass-api.de/api";
const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const OSRM_URL      = process.env.OSRM_URL      || "http://router.project-osrm.org";
const API_TIMEOUT   = 30_000;
const MAX_ATTEMPTS  = 2;
const RETRY_DELAY_MS = 2_000;

// If a cached entry has less than this many seconds left, refresh it in the background
// while still serving the stale value immediately.
const STALE_REFRESH_THRESHOLD = 600; // 10 minutes

// How long to wait for a lock-holding peer to populate the cache before giving up
// and fetching ourselves.
const LOCK_WAIT_MAX_MS      = 10_000;
const LOCK_WAIT_INTERVAL_MS = 300;

// Cache TTL for empty (no-results) upstream responses to avoid hammering APIs.
const NEGATIVE_CACHE_TTL = 300; // 5 minutes

function getCacheKey(prefix: string, ...parts: string[]): string {
  return `wandrmark:${prefix}:${parts.join(":")}`;
}

interface FetchSpec {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

// ─── Core fetch helpers ───────────────────────────────────────────────────────

/**
 * Run the HTTP fetch with retry. Stores the result in Redis when successful.
 */
async function doFetch(
  cacheKey: string,
  spec: FetchSpec,
  hasResults: (data: unknown) => boolean,
  ttl: number,
  timeoutMessage: string
): Promise<{ data: unknown; httpStatus?: number; error?: string }> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(spec.url, {
        method: spec.method ?? "GET",
        headers: spec.headers,
        body: spec.body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status >= 500 && attempt < MAX_ATTEMPTS - 1) continue;
        const stale = await getCache(cacheKey);
        if (stale) return { data: stale };
        const errorText = await response.text();
        return { data: null, httpStatus: response.status, error: errorText.substring(0, 200) };
      }

      const data = await response.json() as unknown;
      if (hasResults(data)) {
        await setCache(cacheKey, data, ttl);
      } else {
        // Cache empty results briefly to avoid repeated hammering of upstream APIs.
        await setCache(cacheKey, data, NEGATIVE_CACHE_TTL);
      }
      return { data };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        if (attempt < MAX_ATTEMPTS - 1) continue;
        const stale = await getCache(cacheKey);
        if (stale) return { data: stale };
        return { data: null, httpStatus: 504, error: timeoutMessage };
      }
      throw err;
    }
  }

  return { data: null, httpStatus: 503, error: "Unexpected error" };
}

/**
 * Poll Redis until the key appears or the deadline passes.
 * Used by requests that lost the stampede lock — they wait for the winner to fill the cache.
 */
async function pollForCache(key: string): Promise<any | null> {
  const deadline = Date.now() + LOCK_WAIT_MAX_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, LOCK_WAIT_INTERVAL_MS));
    const cached = await getCache(key);
    if (cached) return cached;
  }
  return null;
}

/**
 * Fire-and-forget background refresh when a cached entry is close to expiry.
 * Acquires its own lock so only one refresh runs at a time per key.
 */
function refreshInBackground(
  cacheKey: string,
  spec: FetchSpec,
  hasResults: (data: unknown) => boolean,
  ttl: number,
  timeoutMessage: string
): void {
  (async () => {
    const gotLock = await acquireLock(`${cacheKey}:bg`, 35);
    if (!gotLock) return;
    try {
      await doFetch(cacheKey, spec, hasResults, ttl, timeoutMessage);
    } finally {
      await releaseLock(`${cacheKey}:bg`);
    }
  })().catch(() => {});
}

/**
 * Main cache orchestrator:
 *   1. Serve from cache (+ trigger background refresh if TTL is low)
 *   2. Track misses
 *   3. Stampede protection — only one request fetches, others wait
 *   4. Fetch from upstream and cache the result
 */
async function fetchWithCache(
  cacheKey: string,
  spec: FetchSpec,
  hasResults: (data: unknown) => boolean,
  ttl: number,
  timeoutMessage: string
): Promise<{ data: unknown; httpStatus?: number; error?: string }> {

  // 1. Cache hit path
  const cached = await getCache(cacheKey);
  if (cached) {
    const remaining = await getCacheTTL(cacheKey);
    if (remaining > 0 && remaining < STALE_REFRESH_THRESHOLD) {
      refreshInBackground(cacheKey, spec, hasResults, ttl, timeoutMessage);
    }
    return { data: cached };
  }

  // 2. Track the miss (fire-and-forget)
  trackMiss(cacheKey).catch(() => {});

  // 3. Stampede protection
  const gotLock = await acquireLock(cacheKey, 35);
  if (!gotLock) {
    const fromPeer = await pollForCache(cacheKey);
    if (fromPeer) return { data: fromPeer };
    // Peer timed out — fall through and fetch ourselves
  }

  // Check cache once more in case we waited and a peer filled it
  if (gotLock) {
    const doubleCheck = await getCache(cacheKey);
    if (doubleCheck) {
      await releaseLock(cacheKey);
      return { data: doubleCheck };
    }
  }

  try {
    return await doFetch(cacheKey, spec, hasResults, ttl, timeoutMessage);
  } finally {
    if (gotLock) await releaseLock(cacheKey);
  }
}

// ─── Route helpers ────────────────────────────────────────────────────────────

function setCacheHeaders(res: Response, ttl: number): void {
  // max-age matches Redis TTL; stale-while-revalidate gives browsers/CDNs extra time
  // to serve stale content while a background revalidation occurs.
  res.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=${ttl * 8}`);
}

function parseOverpassCategories(query: string): string[] {
  const categories: string[] = [];
  if (/node\["amenity"="restaurant"\]/.test(query))                        categories.push("restaurant");
  if (/node\["amenity"="cafe"\]/.test(query))                              categories.push("cafe");
  if (/node\["tourism"="museum"\]|way\["tourism"="museum"\]/.test(query))  categories.push("museum");
  if (/node\["leisure"="park"\]|way\["leisure"="park"\]/.test(query))      categories.push("park");
  if (/node\["tourism"="attraction"\]|node\["tourism"="viewpoint"\]|node\["tourism"="artwork"\]|node\["historic"|node\["amenity"="theatre"\]/.test(query)) categories.push("attraction");
  return categories.sort();
}

function extractGridCacheKey(query: string): string | null {
  try {
    const m = query.match(/around:\s*(\d+)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (!m) return null;

    const radius = Number(m[1]);
    const lat    = Number(m[2]);
    const lng    = Number(m[3]);

    return getGridCacheKey(lat, lng, radius, parseOverpassCategories(query));
  } catch {
    return null;
  }
}

// Nominatim param allowlists — only forward known safe params to the upstream API.
// This prevents clients from injecting format=xml (breaks JSON parse) or limit=1000
// (bloats Redis). Params not in these sets are silently dropped.
const NOMINATIM_SEARCH_PARAMS = new Set([
  "q", "format", "limit", "addressdetails", "viewbox", "bounded",
  "countrycodes", "accept-language", "namedetails", "extratags",
  "dedupe", "polygon_geojson",
]);
const NOMINATIM_REVERSE_PARAMS = new Set([
  "lat", "lon", "format", "zoom", "addressdetails",
  "accept-language", "namedetails", "extratags", "polygon_geojson",
]);

function filterParams(query: Record<string, unknown>, allowed: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof query[key] === "string") out[key] = query[key] as string;
  }
  return out;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const OVERPASS_QUERY_MAX_LEN = 50_000;

// POST /proxy/overpass
router.post("/overpass", async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query string is required" });
    }
    if (query.length > OVERPASS_QUERY_MAX_LEN) {
      return res.status(400).json({ error: `Query exceeds maximum length of ${OVERPASS_QUERY_MAX_LEN} characters` });
    }

    const fallbackHash = crypto.createHash("md5").update(query).digest("hex");
    const cacheKey = extractGridCacheKey(query) || getCacheKey("overpass", fallbackHash);
    trackOverpassCategories(parseOverpassCategories(query)).catch(() => {});

    const result = await fetchWithCache(
      cacheKey,
      {
        url: `${OVERPASS_URL}/interpreter`,
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Wandrmark/1.0" },
        body: `data=${encodeURIComponent(query)}`,
      },
      (d) => { const data = d as Record<string, unknown>; return Array.isArray(data?.elements) && (data.elements as unknown[]).length > 0; },
      CACHE_TTL.OVERPASS,
      "Overpass API timeout. Try a smaller search area or fewer categories."
    );

    if (result.data !== null && result.data !== undefined) {
      setCacheHeaders(res, CACHE_TTL.OVERPASS);
      return res.json(result.data);
    }
    return res.status(result.httpStatus ?? 503).json({ error: result.error ?? "Overpass API error" });
  } catch (err) {
    console.error("[PROXY] Overpass error:", err);
    return res.status(503).json({ error: "Overpass API unavailable" });
  }
});

// GET /proxy/nominatim/search
router.get("/nominatim/search", async (req: Request, res: Response) => {
  try {
    const filtered = filterParams(req.query as Record<string, unknown>, NOMINATIM_SEARCH_PARAMS);
    const paramsString = new URLSearchParams(filtered).toString();
    // Exclude viewbox from the cache key — it shifts continuously as the map pans and
    // would produce a unique key per viewport position, defeating cache sharing entirely.
    // The viewbox is still forwarded to Nominatim as a ranking bias.
    const cacheParams = new URLSearchParams(filtered);
    cacheParams.delete("viewbox");
    // bounded=1 restricts results to the viewbox area; since viewbox is excluded from
    // the cache key, keeping bounded would store geography-restricted results under a
    // viewbox-free key and serve them to callers that never requested bounded results.
    cacheParams.delete("bounded");
    const cacheKey = getCacheKey("nominatim", "search", cacheParams.toString());
    if (typeof req.query.q === "string") trackGeocodeSearch(req.query.q).catch(() => {});

    const result = await fetchWithCache(
      cacheKey,
      {
        url: `${NOMINATIM_URL}/search?${paramsString}`,
        headers: { "User-Agent": "Wandrmark/1.0", Accept: "application/json" },
      },
      (d) => Array.isArray(d) && (d as unknown[]).length > 0,
      CACHE_TTL.NOMINATIM,
      "Nominatim search timeout"
    );

    if (result.data !== null && result.data !== undefined) {
      setCacheHeaders(res, CACHE_TTL.NOMINATIM);
      return res.json(result.data);
    }
    return res.status(result.httpStatus ?? 503).json({ error: result.error ?? "Nominatim search error" });
  } catch (err) {
    console.error("[PROXY] Nominatim search error:", err);
    return res.status(503).json({ error: "Nominatim API unavailable" });
  }
});

// GET /proxy/nominatim/reverse
router.get("/nominatim/reverse", async (req: Request, res: Response) => {
  try {
    const filtered = filterParams(req.query as Record<string, unknown>, NOMINATIM_REVERSE_PARAMS);
    const paramsString = new URLSearchParams(filtered).toString();
    const cacheKey = getCacheKey("nominatim", "reverse", paramsString);

    const result = await fetchWithCache(
      cacheKey,
      {
        url: `${NOMINATIM_URL}/reverse?${paramsString}`,   // uses filtered params
        headers: { "User-Agent": "Wandrmark/1.0", Accept: "application/json" },
      },
      (d) => {
        const data = d as Record<string, unknown> | null;
        return !!data && !!(data.display_name || data.address);
      },
      CACHE_TTL.NOMINATIM,
      "Nominatim reverse timeout"
    );

    if (result.data !== null && result.data !== undefined) {
      setCacheHeaders(res, CACHE_TTL.NOMINATIM);
      return res.json(result.data);
    }
    return res.status(result.httpStatus ?? 503).json({ error: result.error ?? "Nominatim reverse error" });
  } catch (err) {
    console.error("[PROXY] Nominatim reverse error:", err);
    return res.status(503).json({ error: "Nominatim API unavailable" });
  }
});

// GET /proxy/osrm/route?profile=foot&coordinates=lng1,lat1;lng2,lat2
router.get("/osrm/route", async (req: Request, res: Response) => {
  try {
    const { profile, coordinates } = req.query;

    if (!profile || typeof profile !== "string" || !coordinates || typeof coordinates !== "string") {
      return res.status(400).json({ error: "profile and coordinates query params are required" });
    }

    const ALLOWED_PROFILES = ["foot", "bike", "car"];
    if (!ALLOWED_PROFILES.includes(profile)) {
      return res.status(400).json({ error: "Invalid profile" });
    }
    trackTransportMode(profile).catch(() => {});

    // Validate format: at least two lng,lat pairs separated by semicolons — prevents SSRF path injection
    if (!/^-?\d+\.?\d*,-?\d+\.?\d*(;-?\d+\.?\d*,-?\d+\.?\d*)+$/.test(coordinates)) {
      return res.status(400).json({ error: "Invalid coordinates format" });
    }

    const cacheKey = getCacheKey("osrm", profile, crypto.createHash("md5").update(coordinates).digest("hex"));

    const result = await fetchWithCache(
      cacheKey,
      {
        url: `${OSRM_URL}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson&steps=false&annotations=false`,
        headers: { Accept: "application/json" },
      },
      (d) => {
        const data = d as Record<string, unknown>;
        return data?.code === "Ok" && Array.isArray(data?.routes) && (data.routes as unknown[]).length > 0;
      },
      CACHE_TTL.OSRM,
      "OSRM routing timeout"
    );

    if (result.data !== null && result.data !== undefined) {
      setCacheHeaders(res, CACHE_TTL.OSRM);
      return res.json(result.data);
    }
    return res.status(result.httpStatus ?? 503).json({ error: result.error ?? "OSRM routing error" });
  } catch (err) {
    console.error("[PROXY] OSRM error:", err);
    return res.status(503).json({ error: "OSRM routing unavailable" });
  }
});

export default router;
