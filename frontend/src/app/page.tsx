"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { POI, TransportMode, RouteSegment, Itinerary, LatLng } from "@/types";
import { ExplorerTitle } from "@/types/gamification";
import { usePOIs } from "@/hooks/usePOIs";
import { computeRoute } from "@/services/routing";
import { useGamification } from "@/contexts/GamificationContext";

import Navbar from "@/components/Navbar";
import ExplorerSidebar from "@/components/ExplorerSidebar";
import PlannerSidebar from "@/components/PlannerSidebar";
import AIRecommendPanel from "@/components/AIRecommendPanel";
import POIDetailCard from "@/components/POIDetailCard";
import WayvMap from "@/components/WayvMap";
import PassportPanel from "@/components/PassportPanel";
import AchievementToast, {
  showXPToast,
  showAchievementToast,
  showLevelUpToast,
  showInfoToast,
} from "@/components/AchievementToast";
import { LevelUpModal } from "@/components/LevelUpModal";

const MAP_CENTER_KEY = "wandrmark:lastMapCenter";

function loadSavedCenter(): LatLng | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(MAP_CENTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCenter(center: LatLng) {
  try {
    localStorage.setItem(MAP_CENTER_KEY, JSON.stringify(center));
  } catch {}
}

function readURLCenter(): LatLng | null {
  try {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get("lat") ?? "");
    const lng = parseFloat(params.get("lng") ?? "");
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  } catch {}
  return null;
}

function updateURLCenter(center: LatLng) {
  try {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("lat", center.lat.toFixed(5));
    url.searchParams.set("lng", center.lng.toFixed(5));
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

function deriveCityName(pois: POI[]): string {
  if (pois.length === 0) return "Your Trip";
  const parts = pois[0].address.split(",");
  return parts[parts.length >= 3 ? parts.length - 2 : 0]?.trim() || "Your Trip";
}

export default function Home() {
  const [mode, setMode] = useState<"explorer" | "planner">("explorer");
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [plannerPois, setPlannerPois] = useState<POI[]>([]);
  const [transportMode, setTransportMode] = useState<TransportMode>("walk");
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>(() => {
    const urlCenter = readURLCenter();
    return urlCenter ?? loadSavedCenter() ?? { lat: 40.7128, lng: -74.006 };
  });
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: ExplorerTitle } | null>(null);

  // Left rail: mobile bottom sheet state
  const [leftSheetOpen, setLeftSheetOpen] = useState(false);
  // Right rail: tablet/mobile drawer state
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  // AI panel (planner mode only)
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  // Track mobile breakpoint reactively
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { pois, loading, error, activeCategories, toggleCategory, selectAllCategories, load } = usePOIs();
  const { visitPOI, progress, visitedPoiIds, saveTripMemory } = useGamification();
  const mapMoveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const urlCenter = readURLCenter();
    const saved = loadSavedCenter();
    const fallback = urlCenter ?? saved ?? mapCenter;

    if (urlCenter) {
      setMapCenter(urlCenter);
      load(urlCenter);
      return;
    }

    if (!("geolocation" in navigator)) {
      load(fallback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude };
        setMapCenter(loc);
        saveCenter(loc);
        updateURLCenter(loc);
        load(loc);
      },
      () => load(fallback),
      { timeout: 5000, maximumAge: 300_000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePoiClick = useCallback(async (poi: POI) => {
    setSelectedPoi(poi);
    setLeftSheetOpen(false);
    const result = await visitPOI(poi);

    if (!result.isNew) return;

    showXPToast(result.xpGained);
    result.achievements.forEach((a) => showAchievementToast(a));

    if (result.leveledUp && result.newLevel) {
      const lvl = progress?.passport.level.level ?? 1;
      showLevelUpToast(lvl, result.newLevel as ExplorerTitle);
      setLevelUpData({ level: lvl, title: result.newLevel as ExplorerTitle });
    }
  }, [visitPOI, progress]);

  const handleMapMoved = useCallback((center: LatLng) => {
    setMapCenter(center);
    saveCenter(center);
    updateURLCenter(center);
    if (mapMoveDebounce.current) clearTimeout(mapMoveDebounce.current);
    mapMoveDebounce.current = setTimeout(() => load(center), 600);
  }, [load]);

  const handleSearchResult = useCallback((lat: number, lng: number) => {
    const newCenter = { lat, lng };
    setMapCenter(newCenter);
    saveCenter(newCenter);
    updateURLCenter(newCenter);
    load(newCenter);
    setLeftSheetOpen(false);
  }, [load]);

  const addToPlanner = useCallback((poi: POI | Partial<POI>) => {
    if (poi.id && plannerPois.some((p) => p.id === poi.id)) {
      showInfoToast(`${poi.name || "Place"} is already in your plan`, "📍");
      return;
    }
    setPlannerPois((prev) => [...prev, poi as POI]);
  }, [plannerPois]);

  const removeFromPlanner = useCallback((id: string) => {
    setPlannerPois((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const reorderPlannerPois = useCallback((from: number, to: number) => {
    setPlannerPois((prev) => {
      const updated = [...prev];
      const [item] = updated.splice(from, 1);
      updated.splice(to, 0, item);
      return updated;
    });
  }, []);

  const computeTheRoute = useCallback(async () => {
    if (plannerPois.length < 2) return;
    const validPois = plannerPois.filter((p) => p.coordinates.lat !== 0 && p.coordinates.lng !== 0);
    if (validPois.length < 2) {
      setRouteError("Need at least 2 POIs with real coordinates.");
      return;
    }
    setRouteLoading(true);
    setRouteError(null);
    try {
      const result = await computeRoute(validPois, transportMode);
      setRouteSegments(result.segments);
      setTotalDistance(result.totalDistance);
      setTotalDuration(result.totalDuration);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : "Routing failed.");
    } finally {
      setRouteLoading(false);
    }
  }, [plannerPois, transportMode]);

  const handleSaveItinerary = useCallback((itinerary: Itinerary) => {
    saveTripMemory({
      cityName: deriveCityName(itinerary.route.pois),
      poisVisited: itinerary.route.pois,
      route: itinerary.route.segments,
      distance: itinerary.route.totalDistance,
      duration: itinerary.route.totalDuration,
      notes: itinerary.name,
    });
  }, [saveTripMemory]);

  useEffect(() => {
    setRouteSegments([]);
    setTotalDistance(0);
    setTotalDuration(0);
    setRouteError(null);
  }, [plannerPois]);

  useEffect(() => {
    if (mode === "explorer") setAiPanelOpen(false);
  }, [mode]);

  const handleToggleRightDrawer = useCallback(() => {
    setRightDrawerOpen((prev) => !prev);
  }, []);

  const handleToggleAI = useCallback(() => {
    setAiPanelOpen((prev) => !prev);
  }, []);

  const sidebarContent = mode === "explorer" ? (
    <ExplorerSidebar
      pois={pois}
      loading={loading}
      error={error}
      onPoiClick={handlePoiClick}
      onSearchResult={handleSearchResult}
      onAddToPlanner={addToPlanner}
      onRetry={() => load(mapCenter)}
      activeCategories={activeCategories}
      onToggleCategory={toggleCategory}
      onSelectAllCategories={selectAllCategories}
    />
  ) : (
    <PlannerSidebar
      plannerPois={plannerPois}
      transportMode={transportMode}
      onModeChange={setTransportMode}
      onRemovePoi={removeFromPlanner}
      onReorder={reorderPlannerPois}
      onComputeRoute={computeTheRoute}
      routeSegments={routeSegments}
      totalDistance={totalDistance}
      totalDuration={totalDuration}
      routeLoading={routeLoading}
      routeError={routeError}
      onClear={() => setPlannerPois([])}
      onSaveItinerary={handleSaveItinerary}
    />
  );

  return (
    <div className="app-layout">
      <a className="skip-link" href="#map">Skip to map</a>

      <AchievementToast />

      {levelUpData && (
        <LevelUpModal
          newLevel={levelUpData.title}
          level={levelUpData.level}
          onClose={() => setLevelUpData(null)}
        />
      )}

      {selectedPoi && (
        <POIDetailCard
          poi={selectedPoi}
          onClose={() => setSelectedPoi(null)}
          onAddToPlanner={addToPlanner}
        />
      )}

      {/* Topbar */}
      <Navbar
        mode={mode}
        onModeChange={setMode}
        rightDrawerOpen={rightDrawerOpen}
        onToggleRightDrawer={handleToggleRightDrawer}
      />

      {/* Main stage */}
      <div className="app-stage">
        {/* Backdrop for drawers */}
        <div
          className="drawer-backdrop"
          data-open={rightDrawerOpen || (leftSheetOpen && isMobile) ? "true" : "false"}
          onClick={() => {
            setRightDrawerOpen(false);
            setLeftSheetOpen(false);
          }}
          aria-hidden="true"
        />

        {/* Left rail */}
        <aside
          className="left-rail"
          id="leftRail"
          data-open={leftSheetOpen ? "true" : "false"}
          aria-label="Places and exploration"
        >
          {/* Sheet handle (mobile only) */}
          <button
            className="sheet-handle"
            onClick={() => setLeftSheetOpen((prev) => !prev)}
            aria-label="Toggle places panel"
            aria-controls="leftRail"
            aria-expanded={leftSheetOpen}
          />
          {sidebarContent}
        </aside>

        {/* Map */}
        <main className="map-wrap" id="map" role="application" aria-label="Explore map">
          {plannerPois.length > 0 && mode === "explorer" && (
            <div style={{ position: "absolute", top: "14px", left: "50%", transform: "translateX(-50%)", zIndex: 400, pointerEvents: "auto" }}>
              <button
                onClick={() => setMode("planner")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "7px 14px", borderRadius: "99px",
                  background: "rgba(10,15,23,0.85)", backdropFilter: "blur(8px)",
                  border: "1px solid rgba(95,227,255,0.35)",
                  color: "var(--cyan)", fontSize: "12px", fontFamily: "var(--mono)",
                  fontWeight: 600, letterSpacing: "0.06em", cursor: "pointer",
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--cyan)", animation: "pulse 1.8s infinite" }} />
                {plannerPois.length} stop{plannerPois.length !== 1 ? "s" : ""} · VIEW ROUTE
              </button>
            </div>
          )}

          <WayvMap
            pois={pois}
            selectedPoi={selectedPoi}
            plannerPois={plannerPois}
            routeSegments={routeSegments}
            onPoiClick={handlePoiClick}
            onMapMoved={handleMapMoved}
            loading={loading}
            center={mapCenter}
            visitedPoiIds={visitedPoiIds}
            cityName={pois.length > 0 ? deriveCityName(pois) : undefined}
          />
        </main>

        {/* Right rail — always on desktop, drawer on tablet/mobile */}
        <aside
          className="right-rail"
          id="rightRail"
          data-open={rightDrawerOpen ? "true" : "false"}
          aria-label="Explorer passport and stats"
        >
          {/* Passport / AI toggle header */}
          <div style={{ display: "flex", gap: "6px", padding: "8px 10px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
            <button
              onClick={() => setAiPanelOpen(false)}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
                padding: "7px 10px", borderRadius: "8px", cursor: "pointer",
                border: `1px solid ${!aiPanelOpen ? "rgba(95,227,255,0.35)" : "var(--line-2)"}`,
                background: !aiPanelOpen ? "linear-gradient(180deg, rgba(95,227,255,0.14), rgba(95,227,255,0.04))" : "rgba(8,12,18,0.5)",
                color: !aiPanelOpen ? "var(--cyan)" : "var(--ink-3)",
                fontFamily: "var(--font)", fontWeight: 500, fontSize: "12px",
                transition: "all 0.12s ease",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 11h20"/><circle cx="7" cy="8" r="1" fill="currentColor"/><circle cx="11" cy="8" r="1" fill="currentColor"/>
              </svg>
              Passport
            </button>
            <button
              onClick={() => { setAiPanelOpen(true); if (mode === "explorer") setMode("planner"); }}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
                padding: "7px 10px", borderRadius: "8px", cursor: "pointer",
                border: `1px solid ${aiPanelOpen ? "rgba(177,150,255,0.35)" : "var(--line-2)"}`,
                background: aiPanelOpen ? "linear-gradient(180deg, rgba(177,150,255,0.14), rgba(177,150,255,0.04))" : "rgba(8,12,18,0.5)",
                color: aiPanelOpen ? "var(--orchid)" : "var(--ink-3)",
                fontFamily: "var(--font)", fontWeight: 500, fontSize: "12px",
                transition: "all 0.12s ease",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/>
                <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>
              </svg>
              AI
            </button>
          </div>

          {aiPanelOpen ? (
            <AIRecommendPanel selectedPois={plannerPois} onAddToPlanner={addToPlanner} />
          ) : (
            <PassportPanel />
          )}
        </aside>
      </div>
    </div>
  );
}
