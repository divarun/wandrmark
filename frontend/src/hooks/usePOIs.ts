"use client";
import { useState, useCallback, useRef, useMemo } from "react";
import { POI, POICategory, LatLng } from "@/types";
import { fetchPOIs } from "@/services/overpass";

export function usePOIs() {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    try {
      const results = await fetchPOIs(center, radius, undefined, abortRef.current?.signal);
      setPois(results);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
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

  const filteredPois = useMemo(
    () => pois.filter((poi) => activeCategories.includes(poi.category)),
    [pois, activeCategories]
  );

  return {
    pois: filteredPois,
    loading,
    error,
    activeCategories,
    toggleCategory,
    load,
  };
}