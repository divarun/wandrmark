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
}

/* ------------------------------------------------------------------ */
/* Geocoding search                                                    */
/* ------------------------------------------------------------------ */

let last429Time = 0;
const COOLDOWN_AFTER_429 = 2000;

const reverseGeocodeCache = new Map<string, string>();

export async function geocodeSearch(
  query: string,
  limit: number = 5
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

    const response = await fetch(`${BASE_URL}/proxy/nominatim/search?${params}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 429) {
      last429Time = now;
      return [];
    }

    if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

    const data = await response.json();

    return data.map((item: any) => {
      const addr = item.address || {};
      const shortName =
        addr.city || addr.town || addr.village || addr.hamlet ||
        addr.suburb || item.display_name.split(",")[0].trim();
      const state = addr.state || addr.county || "";
      const country = addr.country || "";
      const region = [state, country].filter(Boolean).join(", ");
      return {
        id: item.place_id,
        displayName: item.display_name,
        shortName,
        region,
        coordinates: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
        type: item.type || "",
        category: item.category || "",
      };
    });
  } catch {
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
