"use client";
import { useState, useCallback, useRef, useMemo } from "react";
import { POI, POICategory, LatLng } from "@/types";
import { fetchPOIs } from "@/services/overpass";

const POI_CACHE_KEY = "wandrmark:pois-cache";
const POI_CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface PoiCache { pois: POI[]; center: LatLng; timestamp: number }

function loadPoiCache(): PoiCache | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(POI_CACHE_KEY);
    if (!raw) return null;
    const data: PoiCache = JSON.parse(raw);
    if (Date.now() - data.timestamp > POI_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function savePoiCache(pois: POI[], center: LatLng): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(POI_CACHE_KEY, JSON.stringify({ pois, center, timestamp: Date.now() }));
  } catch {}
}

export function usePOIs() {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [activeCategories, setActiveCategories] = useState<POICategory[]>([
    "restaurant",
    "cafe",
    "attraction",
    "park",
    "museum",
  ]);
  const abortRef = useRef<AbortController | null>(null);

  // Always fetch all categories — toggling filters client-side without an API call
  const load = useCallback(async (center: LatLng, radius: number = 1500) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setIsCached(false);
    try {
      const results = await fetchPOIs(center, radius, undefined, abortRef.current?.signal);
      setPois(results);
      savePoiCache(results, center);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        const cached = loadPoiCache();
        if (cached) {
          setPois(cached.pois);
          setIsCached(true);
          setError("You're offline — showing nearby places from cache");
        } else {
          setError(err.message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleCategory = useCallback((cat: POICategory) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const selectAllCategories = useCallback(() => {
    setActiveCategories(["restaurant", "cafe", "attraction", "park", "museum"]);
  }, []);

  const filteredPois = useMemo(
    () => pois.filter((poi) => activeCategories.includes(poi.category)),
    [pois, activeCategories]
  );

  return {
    pois: filteredPois,
    loading,
    error,
    isCached,
    activeCategories,
    toggleCategory,
    selectAllCategories,
    load,
  };
}