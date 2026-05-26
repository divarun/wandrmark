"use client";
import { useState, useCallback } from "react";
import { SavedPOI, POI } from "@/types";
import { localFavorites } from "@/services/localStorage";

export function useFavorites() {
  const [favorites, setFavorites] = useState<SavedPOI[]>(() => {
    if (typeof window === "undefined") return [];
    return localFavorites.getAll();
  });

  const addFavorite = useCallback((poi: POI) => {
    const saved: SavedPOI = { ...poi, savedAt: Date.now() };
    localFavorites.add(saved);
    setFavorites((prev) => (prev.some((p) => p.id === poi.id) ? prev : [...prev, saved]));
  }, []);

  const removeFavorite = useCallback((poiId: string) => {
    localFavorites.remove(poiId);
    setFavorites((prev) => prev.filter((p) => p.id !== poiId));
  }, []);

  const isFavorite = useCallback(
    (poiId: string) => favorites.some((p) => p.id === poiId),
    [favorites]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
}
