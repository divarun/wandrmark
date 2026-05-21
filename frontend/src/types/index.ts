export interface LatLng {
  lat: number;
  lng: number;
}

export type POICategory = "restaurant" | "cafe" | "attraction" | "park" | "museum";

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  address: string;
  coordinates: LatLng;
  openingHours?: string;
  rating?: number;
  photoUrl?: string;
  description?: string;
  tags?: string[];
  overpassId?: string;
}

export interface SavedPOI extends POI {
  savedAt: number;
}

export type TransportMode = "walk" | "bike" | "car" | "transit";

export interface RouteSegment {
  from: POI;
  to: POI;
  distance: number;
  duration: number;
  geometry: LatLng[];
}

export interface Route {
  id: string;
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  transportMode: TransportMode;
  createdAt: number;
  pois: POI[];
}

export interface Itinerary {
  id: string;
  name: string;
  route: Route;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AIRecommendation {
  poi: POI;
  reason: string;
  confidence: number;
}

export interface AITravelTip {
  poiId: string;
  description: string;
  tips: string[];
  localInsights: string;
}

export interface AppSettings {
  defaultCenter: LatLng;
  defaultZoom: number;
  language: string;
}

export interface OSRMRouteResponse {
  routes: Array<{
    geometry: {
      coordinates: [number, number][];
      type: string;
    };
    legs: Array<{
      distance: number;
      duration: number;
    }>;
    distance: number;
    duration: number;
  }>;
  code: string;
}

export interface NominatimResult {
  id: string;
  lat: string;
  lon: string;
  display_name: string;
  category: string;
  type: string;
  address?: {
    restaurant?: string;
    cafe?: string;
    tourism?: string;
    leisure?: string;
    amenity?: string;
    [key: string]: string | undefined;
  };
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    amenity?: string;
    tourism?: string;
    leisure?: string;
    cuisine?: string;
    opening_hours?: string;
    "cuisine:type"?: string;
    website?: string;
    phone?: string;
    [key: string]: string | undefined;
  };
}

export interface OverpassResponse {
  elements: OverpassElement[];
}
