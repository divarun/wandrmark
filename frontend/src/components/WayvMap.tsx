"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { POI, LatLng, RouteSegment } from "@/types";

let L: typeof import("leaflet");

if (typeof window !== "undefined") {
  L = require("leaflet");
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

export default function WayvMap({
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
  const markersRef = useRef<L.Marker[]>([]);
  const plannerMarkersRef = useRef<L.Marker[]>([]);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const moveEndHandlerRef = useRef<boolean>(false);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || !L) return;
    if (mapRef.current) return;

    const initialCenter = center || { lat: 40.7128, lng: -74.006 };

    const map = L.map(containerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 13,
      zoomControl: false,
    });

    // Two-layer tile setup: base (no labels) + labels overlay
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

    map.on("moveend", () => {
      if (moveEndHandlerRef.current) {
        const c = map.getCenter();
        onMapMoved({ lat: c.lat, lng: c.lng });
      }
    });

    mapRef.current = map;

    setTimeout(() => {
      moveEndHandlerRef.current = true;
    }, 500);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onMapMoved]);

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

  // Render POI markers using CSS class-based circles
  useEffect(() => {
    if (!mapRef.current || !L) return;

    const map = mapRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pois.forEach((poi) => {
      const isVisited = visitedPoiIds?.has(poi.id) ?? false;

      const icon = L.divIcon({
        html: `<div class="poi-marker-dot ${poi.category}${isVisited ? " visited" : ""}"></div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([poi.coordinates.lat, poi.coordinates.lng], { icon })
        .addTo(map)
        .on("click", () => onPoiClick(poi));

      markersRef.current.push(marker);
    });
  }, [pois, onPoiClick, visitedPoiIds]);

  // Render planner markers
  useEffect(() => {
    if (!mapRef.current || !L) return;

    const map = mapRef.current;
    plannerMarkersRef.current.forEach((m) => m.remove());
    plannerMarkersRef.current = [];

    plannerPois.forEach((poi, index) => {
      const icon = L.divIcon({
        html: `<div class="planner-marker-dot">${index + 1}</div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([poi.coordinates.lat, poi.coordinates.lng], { icon })
        .addTo(map)
        .on("click", () => onPoiClick(poi));

      plannerMarkersRef.current.push(marker);
    });
  }, [plannerPois, onPoiClick]);

  // Render route polylines
  useEffect(() => {
    if (!mapRef.current || !L) return;

    const map = mapRef.current;
    routeLinesRef.current.forEach((line) => line.remove());
    routeLinesRef.current = [];

    routeSegments.forEach((segment) => {
      const coords: L.LatLngExpression[] = segment.geometry.map((c) => [c.lat, c.lng]);
      const polyline = L.polyline(coords, {
        color: "#38bdf8",
        weight: 4,
        opacity: 0.85,
      }).addTo(map);
      routeLinesRef.current.push(polyline);
    });

    if (routeSegments.length > 0 && plannerPois.length > 0) {
      const allCoords: L.LatLngExpression[] = [];
      routeSegments.forEach((seg) => {
        seg.geometry.forEach((c) => allCoords.push([c.lat, c.lng]));
      });
      if (allCoords.length > 0) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
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
      <div ref={containerRef} className="w-full h-full relative z-0" />

      {/* City watermark */}
      {cityName && (
        <div
          style={{
            position: "absolute", left: "24px", top: "20px",
            zIndex: 10, pointerEvents: "none",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
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
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[5] pointer-events-none">
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
