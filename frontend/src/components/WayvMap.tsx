"use client";

import { memo, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { POI, LatLng, RouteSegment } from "@/types";

let L: typeof import("leaflet");

if (typeof window !== "undefined") {
  L = require("leaflet");
  require("leaflet.markercluster");
}

function makePoiIcon(poi: POI, isVisited: boolean): L.DivIcon {
  return L.divIcon({
    html: `<div class="poi-marker-dot ${poi.category}${isVisited ? " visited" : ""}" role="img" aria-label="${poi.name}"></div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

interface WayvMapProps {
  pois: POI[];
  selectedPoi: POI | null;
  plannerPois: POI[];
  routeSegments: RouteSegment[];
  onPoiClick: (poi: POI) => void;
  onMapMoved: (center: LatLng) => void;
  loading: boolean;
  center?: LatLng;
  visitedPoiIds?: Set<string>;
  cityName?: string;
}

function WayvMapInner({
  pois,
  selectedPoi,
  plannerPois,
  routeSegments,
  onPoiClick,
  onMapMoved,
  loading,
  center,
  visitedPoiIds,
  cityName,
}: WayvMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterGroupRef = useRef<any>(null);
  const plannerMarkersRef = useRef<L.Marker[]>([]);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const moveEndHandlerRef = useRef<boolean>(false);

  // Stable refs so init effect can have empty deps — no risk of map destroy/recreate
  const onMapMovedRef = useRef(onMapMoved);
  useEffect(() => { onMapMovedRef.current = onMapMoved; });
  const onPoiClickRef = useRef(onPoiClick);
  useEffect(() => { onPoiClickRef.current = onPoiClick; });

  // Registry of POI id → { marker, poi } so we can diff instead of clear-all-rebuild
  const markerMapRef = useRef<Map<string, { marker: L.Marker; poi: POI }>>(new Map());
  // Readable ref for visitedPoiIds so the pois-sync effect can read current state
  // without taking it as a dep (it has its own dedicated effect below)
  const visitedPoiIdsRef = useRef(visitedPoiIds);
  useEffect(() => { visitedPoiIdsRef.current = visitedPoiIds; });

  // Init map once — empty deps; onMapMoved and onPoiClick read through refs
  useEffect(() => {
    if (!containerRef.current || !L) return;
    if (mapRef.current) return;

    const initialCenter = center || { lat: 40.7128, lng: -74.006 };

    const map = L.map(containerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
      pane: "shadowPane",
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const sizeClass = count < 10 ? "small" : count < 100 ? "medium" : "large";
        return L.divIcon({
          html: `<div class="marker-cluster marker-cluster-${sizeClass}" role="img" aria-label="${count} places nearby"><div><span>${count}</span></div></div>`,
          className: "",
          iconSize: [40, 40] as [number, number],
          iconAnchor: [20, 20] as [number, number],
        });
      },
    });
    clusterGroup.addTo(map);
    clusterGroupRef.current = clusterGroup;

    map.on("moveend", () => {
      if (moveEndHandlerRef.current) {
        const c = map.getCenter();
        onMapMovedRef.current({ lat: c.lat, lng: c.lng });
      }
    });

    mapRef.current = map;
    setTimeout(() => { moveEndHandlerRef.current = true; }, 500);

    return () => {
      map.remove();
      mapRef.current = null;
      clusterGroupRef.current = null;
      markerMapRef.current.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update center when prop changes
  useEffect(() => {
    if (!mapRef.current || !center) return;

    const map = mapRef.current;
    const currentCenter = map.getCenter();
    const distance = Math.sqrt(
      Math.pow(currentCenter.lat - center.lat, 2) +
      Math.pow(currentCenter.lng - center.lng, 2)
    );

    if (distance > 0.001) {
      moveEndHandlerRef.current = false;
      map.setView([center.lat, center.lng], 13);
      setTimeout(() => { moveEndHandlerRef.current = true; }, 500);
    }
  }, [center]);

  // Sync POI markers: diff additions/removals instead of clear-all-rebuild.
  // visitedPoiIds is intentionally excluded — it has its own effect below.
  useEffect(() => {
    if (!clusterGroupRef.current || !L) return;

    const markerMap = markerMapRef.current;
    const incomingIds = new Set(pois.map((p) => p.id));

    // Remove markers for POIs that are no longer in the list
    for (const [id, { marker }] of markerMap) {
      if (!incomingIds.has(id)) {
        clusterGroupRef.current.removeLayer(marker);
        markerMap.delete(id);
      }
    }

    // Add markers for newly visible POIs
    for (const poi of pois) {
      if (markerMap.has(poi.id)) continue;
      const isVisited = visitedPoiIdsRef.current?.has(poi.id) ?? false;
      const marker = L.marker([poi.coordinates.lat, poi.coordinates.lng], {
        icon: makePoiIcon(poi, isVisited),
      }).on("click", () => onPoiClickRef.current(poi));
      clusterGroupRef.current.addLayer(marker);
      markerMap.set(poi.id, { marker, poi });
    }
  }, [pois]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update only visited-state icons — never recreates markers
  useEffect(() => {
    if (!L) return;
    for (const [id, { marker, poi }] of markerMapRef.current) {
      const isVisited = visitedPoiIds?.has(id) ?? false;
      marker.setIcon(makePoiIcon(poi, isVisited));
    }
  }, [visitedPoiIds]);

  // Render planner markers (never clustered — always visible)
  useEffect(() => {
    if (!mapRef.current || !L) return;

    plannerMarkersRef.current.forEach((m) => m.remove());
    plannerMarkersRef.current = [];

    plannerPois.forEach((poi, index) => {
      const icon = L.divIcon({
        html: `<div class="planner-marker-dot" aria-label="Stop ${index + 1}: ${poi.name}">${index + 1}</div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([poi.coordinates.lat, poi.coordinates.lng], { icon })
        .addTo(mapRef.current!)
        .on("click", () => onPoiClickRef.current(poi));

      plannerMarkersRef.current.push(marker);
    });
  }, [plannerPois]);

  // Render route polylines
  useEffect(() => {
    if (!mapRef.current || !L) return;

    routeLinesRef.current.forEach((line) => line.remove());
    routeLinesRef.current = [];

    routeSegments.forEach((segment) => {
      const coords: L.LatLngExpression[] = segment.geometry.map((c) => [c.lat, c.lng]);
      const polyline = L.polyline(coords, {
        color: "#38bdf8",
        weight: 4,
        opacity: 0.85,
      }).addTo(mapRef.current!);
      routeLinesRef.current.push(polyline);
    });

    if (routeSegments.length > 0 && plannerPois.length > 0) {
      const allCoords: L.LatLngExpression[] = [];
      routeSegments.forEach((seg) => {
        seg.geometry.forEach((c) => allCoords.push([c.lat, c.lng]));
      });
      if (allCoords.length > 0) {
        mapRef.current.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
      }
    }
  }, [routeSegments, plannerPois]);

  // Pan to selected POI
  useEffect(() => {
    if (!mapRef.current || !L || !selectedPoi) return;
    mapRef.current.panTo([selectedPoi.coordinates.lat, selectedPoi.coordinates.lng]);
  }, [selectedPoi]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full relative z-0" aria-label="Interactive map" role="application" />

      {cityName && (
        <div
          style={{
            position: "absolute", left: "24px", top: "20px",
            zIndex: 10, pointerEvents: "none",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
          aria-hidden="true"
        >
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase",
            color: "var(--ink-3)", marginBottom: "4px",
          }}>
            exploring
          </div>
          <div style={{
            fontSize: "36px", fontWeight: 700, letterSpacing: "-0.025em",
            color: "oklch(1 0 0 / 0.07)", lineHeight: 1,
          }}>
            {cityName}
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[5] pointer-events-none" role="status" aria-live="polite" aria-label="Loading places">
          <div
            className="rounded-full px-4 py-1.5 flex items-center gap-2"
            style={{
              background: "oklch(0.22 0.03 250 / 0.85)",
              border: "1px solid var(--line)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 animate-spin"
              style={{ borderColor: "var(--cyan)", borderTopColor: "transparent" }}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
              Loading places…
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const WayvMap = memo(WayvMapInner);
export default WayvMap;
