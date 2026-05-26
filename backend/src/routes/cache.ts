import { Router, Request, Response } from "express";
import { deleteCachePattern, checkRedisHealth } from "../services/cache";
import { getAllUsage, getIpUsage } from "../services/usage";
import { warmGeocodingCache } from "../scripts/warmGeocoding";
import { warmMajorCities } from "../scripts/warmCache";
import { checkAdminAuth } from "../middleware/adminAuth";

const router = Router();

router.get("/health", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const healthy = await checkRedisHealth();
    if (healthy) {
      return res.json({ status: "healthy" });
    }
    return res.status(503).json({ status: "unhealthy" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

const WARM_MODES = ["top", "all", "geocoding"] as const;

router.post("/warm", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const { mode = "top", cities, skipExisting = false } = req.body;
    if (!WARM_MODES.includes(mode)) {
      return res.status(400).json({ error: `Invalid mode. Must be one of: ${WARM_MODES.join(", ")}` });
    }
    const targetCities: string[] | undefined = Array.isArray(cities) ? cities : undefined;

    res.json({ status: "started", mode, message: "Cache warming started — check server logs." });

    const run = async () => {
      if (mode === "geocoding") {
        await warmGeocodingCache(targetCities);
      } else {
        await warmMajorCities(targetCities, { skipExisting, saveFailures: false });
      }
    };

    run().catch((err) => console.error("[CACHE WARM] Error:", err));
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

const CLEAR_PATTERNS = ["overpass", "nominatim", "ai"] as const;

router.delete("/clear", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const { pattern } = req.query;
    if (pattern !== undefined && (typeof pattern !== "string" || !CLEAR_PATTERNS.includes(pattern as typeof CLEAR_PATTERNS[number]))) {
      return res.status(400).json({ error: `Invalid pattern. Must be one of: ${CLEAR_PATTERNS.join(", ")}` });
    }
    const key = pattern ? `wandrmark:${pattern}:*` : "wandrmark:*";
    const count = await deleteCachePattern(key);
    res.json({ success: true, deletedCount: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

// GET /cache/usage — all IPs (requires warm secret)
router.get("/usage", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const data = await getAllUsage();
    res.json({ count: data.length, ips: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve usage data" });
  }
});

// GET /cache/usage/:ip — one IP's usage (requires warm secret)
router.get("/usage/:ip", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) return;
  if (!/^[\d.:a-fA-F]+$/.test(req.params.ip)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }
  try {
    const data = await getIpUsage(req.params.ip);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve usage data" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const { default: redis } = await import("../services/cache");
    const [overpass, nominatim, ai] = await Promise.all([
      (redis as any).keys("wandrmark:overpass:*"),
      (redis as any).keys("wandrmark:nominatim:*"),
      (redis as any).keys("wandrmark:ai:*"),
    ]);
    res.json({
      total: overpass.length + nominatim.length + ai.length,
      breakdown: { overpass: overpass.length, nominatim: nominatim.length, ai: ai.length },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

export default router;
