import { SavedPOI, Itinerary } from "@/types";

const KEYS = {
  FAVORITES: "wandrmark:favorites",
  ITINERARIES: "wandrmark:itineraries",
} as const;

function safeGet<T>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const localFavorites = {
  getAll(): SavedPOI[] {
    return safeGet<SavedPOI[]>(KEYS.FAVORITES) ?? [];
  },
  add(poi: SavedPOI): void {
    const current = this.getAll();
    if (current.some((p) => p.id === poi.id)) return;
    safeSet(KEYS.FAVORITES, [...current, poi]);
  },
  remove(poiId: string): void {
    safeSet(KEYS.FAVORITES, this.getAll().filter((p) => p.id !== poiId));
  },
  has(poiId: string): boolean {
    return this.getAll().some((p) => p.id === poiId);
  },
};

export const localItineraries = {
  getAll(): Itinerary[] {
    return safeGet<Itinerary[]>(KEYS.ITINERARIES) ?? [];
  },
  add(itinerary: Itinerary): void {
    safeSet(KEYS.ITINERARIES, [...this.getAll(), itinerary]);
  },
  remove(id: string): void {
    safeSet(KEYS.ITINERARIES, this.getAll().filter((it) => it.id !== id));
  },
};
