import { LatLng, POI, POICategory } from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api";

/* ------------------------------------------------------------------ */
/* Main fetch                                                          */
/* ------------------------------------------------------------------ */

export async function fetchPOIs(
  center: LatLng,
  radiusMeters: number = 1500,
  categories: POICategory[] = ["restaurant", "cafe", "museum", "park", "attraction"],
  signal?: AbortSignal
): Promise<POI[]> {
  const safeRadius = Math.min(radiusMeters, 1500);

  const response = await fetch(`${BASE_URL}/proxy/overpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: buildOptimizedQuery(center, safeRadius, categories),
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 504
        ? "Location data timed out — try a smaller area or check back shortly."
        : `Could not load nearby places (${response.status}).`
    );
  }

  const data = await response.json();

  if (!data.elements?.length) return [];

  return data.elements
    .map(mapElementToPOI)
    .filter((p: POI | null): p is POI => p !== null)
    .slice(0, 60);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function buildOptimizedQuery(
  center: LatLng,
  radius: number,
  categories: POICategory[]
): string {
  const queries: string[] = [];

  categories.forEach((category) => {
    switch (category) {
      case "restaurant":
        queries.push(`node["amenity"="restaurant"](around:${radius},${center.lat},${center.lng});`);
        break;
      case "cafe":
        queries.push(`node["amenity"="cafe"](around:${radius},${center.lat},${center.lng});`);
        break;
      case "museum":
        queries.push(`node["tourism"="museum"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`way["tourism"="museum"](around:${radius},${center.lat},${center.lng});`);
        break;
      case "park":
        queries.push(`node["leisure"="park"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`way["leisure"="park"](around:${radius},${center.lat},${center.lng});`);
        break;
      case "attraction":
        queries.push(`node["tourism"="attraction"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["tourism"="viewpoint"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["tourism"="artwork"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["tourism"="gallery"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["historic"="monument"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["historic"="memorial"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["historic"="castle"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`way["historic"="castle"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["historic"="ruins"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["amenity"="theatre"](around:${radius},${center.lat},${center.lng});`);
        queries.push(`node["amenity"="arts_centre"](around:${radius},${center.lat},${center.lng});`);
        break;
    }
  });

  return `
[out:json][timeout:25];
(
  ${queries.join("\n  ")}
);
out body center 60;
  `.trim();
}

function mapElementToPOI(el: any): POI | null {
  if (!el.lat && !el.lon) {
    if (el.center) {
      el.lat = el.center.lat;
      el.lon = el.center.lon;
    } else {
      return null;
    }
  }

  const tags = el.tags || {};
  const name =
    tags.name ||
    tags["name:en"] ||
    tags.operator ||
    tags.brand ||
    tags["alt_name"] ||
    tags.description ||
    tags.ref ||
    "Unnamed Place";

  let category: POICategory = "attraction";
  if (tags.amenity === "restaurant") category = "restaurant";
  else if (tags.amenity === "cafe") category = "cafe";
  else if (tags.tourism === "museum") category = "museum";
  else if (tags.leisure === "park") category = "park";
  else if (
    tags.tourism === "attraction" ||
    tags.tourism === "viewpoint" ||
    tags.tourism === "artwork" ||
    tags.tourism === "gallery" ||
    tags.historic === "monument" ||
    tags.historic === "memorial" ||
    tags.historic === "castle" ||
    tags.historic === "ruins" ||
    tags.amenity === "theatre" ||
    tags.amenity === "arts_centre"
  ) category = "attraction";

  const addressParts: string[] = [];
  if (tags["addr:housenumber"] && tags["addr:street"]) {
    addressParts.push(`${tags["addr:housenumber"]} ${tags["addr:street"]}`);
  } else if (tags["addr:street"]) {
    addressParts.push(tags["addr:street"]);
  }

  if (tags["addr:city"]) addressParts.push(tags["addr:city"]);
  else if (tags["addr:suburb"]) addressParts.push(tags["addr:suburb"]);
  else if (tags["addr:district"]) addressParts.push(tags["addr:district"]);

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    category,
    address: addressParts.length ? addressParts.join(", ") : "Address not available",
    coordinates: { lat: el.lat, lng: el.lon },
    openingHours: tags.opening_hours,
    tags: tags.cuisine ? [tags.cuisine] : undefined,
  };
}
