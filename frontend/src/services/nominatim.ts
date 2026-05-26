import { LatLng } from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api";

export interface GeocodingResult {
  id: string;
  displayName: string;
  shortName: string;
  region: string;
  coordinates: LatLng;
  type: string;
  category: string;
  distanceKm?: number;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/* ------------------------------------------------------------------ */
/* Geocoding search                                                    */
/* ------------------------------------------------------------------ */

let last429Time = 0;
const COOLDOWN_AFTER_429 = 2000;

const reverseGeocodeCache = new Map<string, string>();

interface NominatimItem {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  category?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    state?: string;
    county?: string;
    country?: string;
  };
}

export async function geocodeSearch(
  query: string,
  limit: number = 5,
  signal?: AbortSignal,
  center?: LatLng
): Promise<GeocodingResult[]> {
  const now = Date.now();
  if (!query.trim() || now - last429Time < COOLDOWN_AFTER_429) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: String(limit),
      addressdetails: "1",
      extratags: "1",
    });

    // Bias results toward the current map area (±0.5° box, ~55 km)
    if (center) {
      params.set("viewbox", `${center.lng - 0.5},${center.lat + 0.5},${center.lng + 0.5},${center.lat - 0.5}`);
    }

    const response = await fetch(`${BASE_URL}/proxy/nominatim/search?${params}`, {
      headers: { "Content-Type": "application/json" },
      signal,
    });

    if (response.status === 429) {
      last429Time = now;
      return [];
    }

    if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

    const data = await response.json() as NominatimItem[];

    const results: GeocodingResult[] = data.map((item) => {
      const addr = item.address || {};
      const shortName =
        addr.city || addr.town || addr.village || addr.hamlet ||
        addr.suburb || item.display_name.split(",")[0].trim();
      const state = addr.state || addr.county || "";
      const country = addr.country || "";
      const region = [state, country].filter(Boolean).join(", ");
      const coordinates = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
      return {
        id: item.place_id,
        displayName: item.display_name,
        shortName,
        region,
        coordinates,
        type: item.type || "",
        category: item.category || "",
        distanceKm: center ? haversineKm(center, coordinates) : undefined,
      };
    });

    return results;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return [];
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Reverse geocoding                                                   */
/* ------------------------------------------------------------------ */

export async function reverseGeocode(coords: LatLng): Promise<string> {
  const fallback = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  const cacheKey = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;

  if (reverseGeocodeCache.has(cacheKey)) return reverseGeocodeCache.get(cacheKey)!;

  const now = Date.now();
  if (now - last429Time < COOLDOWN_AFTER_429) return fallback;

  try {
    const params = new URLSearchParams({
      lat: String(coords.lat),
      lon: String(coords.lng),
      format: "json",
      zoom: "16",
    });

    const response = await fetch(`${BASE_URL}/proxy/nominatim/reverse?${params}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 429) {
      last429Time = now;
      return fallback;
    }

    if (!response.ok) return fallback;

    const data = await response.json();
    const result = data.display_name || fallback;
    reverseGeocodeCache.set(cacheKey, result);
    return result;
  } catch {
    return fallback;
  }
}
