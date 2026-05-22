"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { POI, TransportMode, RouteSegment, Itinerary, LatLng } from "@/types";
import { ExplorerTitle } from "@/types/gamification";
import { usePOIs } from "@/hooks/usePOIs";
import { computeRoute } from "@/services/routing";
import { useGamification } from "@/contexts/GamificationContext";

import Navbar from "@/components/Navbar";
import CategoryFilter from "@/components/CategoryFilter";
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
  const [rightPanel, setRightPanel] = useState<"passport" | "ai" | null>(null);
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: ExplorerTitle } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    setSidebarOpen(false);
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
    setSidebarOpen(false);
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
    if (mode === "explorer" && rightPanel === "ai") setRightPanel(null);
  }, [mode, rightPanel]);

  const handleToggleRightPanel = useCallback((panel: "passport" | "ai") => {
    setRightPanel((prev) => (prev === panel ? null : panel));
  }, []);

  // Mobile bottom nav: tap active mode button to toggle sidebar; tap inactive to switch + open
  const handleMobileNavMode = useCallback((newMode: "explorer" | "planner") => {
    if (mode === newMode) {
      setSidebarOpen((prev) => !prev);
    } else {
      setMode(newMode);
      setSidebarOpen(true);
    }
  }, [mode]);

  const sidebarContent = mode === "explorer" ? (
    <ExplorerSidebar
      pois={pois}
      loading={loading}
      error={error}
      onPoiClick={handlePoiClick}
      onSearchResult={handleSearchResult}
      onAddToPlanner={addToPlanner}
      onRetry={() => load(mapCenter)}
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

  const rightPanelContent = (
    <>
      {rightPanel === "passport" && <PassportPanel />}
      {rightPanel === "ai" && mode === "planner" && (
        <AIRecommendPanel selectedPois={plannerPois} onAddToPlanner={addToPlanner} />
      )}
    </>
  );

  return (
    <div className="min-h-screen h-screen overflow-hidden flex flex-col" style={{ background: "var(--bg)" }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(1200px 700px at 50% -200px, oklch(0.28 0.08 230 / 0.3), transparent 60%)" }}
      />

      <AchievementToast />

      {levelUpData && (
        <LevelUpModal
          newLevel={levelUpData.title}
          level={levelUpData.level}
          onClose={() => setLevelUpData(null)}
        />
      )}

      <Navbar
        mode={mode}
        onModeChange={setMode}
        rightPanel={rightPanel}
        onToggleRightPanel={handleToggleRightPanel}
      />

      {selectedPoi && (
        <POIDetailCard
          poi={selectedPoi}
          onClose={() => setSelectedPoi(null)}
          onAddToPlanner={addToPlanner}
        />
      )}

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[35] flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] flex flex-col h-full animate-slide-in-left" style={{ background: "var(--bg-2)", borderRight: "1px solid var(--line)" }}>
            <div className="flex-shrink-0 flex items-center gap-2" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
              <div className="flex-1 min-w-0">
                <CategoryFilter active={activeCategories} onToggle={toggleCategory} onSelectAll={selectAllCategories} />
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white text-sm flex-shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}

      {/* Mobile right panel (bottom sheet) */}
      {rightPanel !== null && (
        <div className="md:hidden fixed inset-0 z-[35] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => handleToggleRightPanel(rightPanel)}
          />
          <div
            className="relative flex flex-col overflow-hidden animate-slide-up"
            style={{
              maxHeight: "82vh",
              background: "var(--bg-2)",
              borderTop: "1px solid var(--line)",
              borderRadius: "20px 20px 0 0",
              marginBottom: "56px",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div style={{ width: "40px", height: "4px", borderRadius: "99px", background: "oklch(0.40 0.03 250)" }} />
            </div>
            {/* Scrollable content — PassportPanel uses flex-col h-full internally */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
              {rightPanelContent}
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 pt-14 pb-14 md:pb-0 overflow-hidden relative">

        {/* Desktop left sidebar */}
        <div className="hidden md:flex w-80 flex-shrink-0 flex-col relative z-10 overflow-hidden" style={{ background: "linear-gradient(180deg, var(--bg-2), var(--bg))", borderRight: "1px solid var(--line)" }}>
          <div className="flex-shrink-0" style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <CategoryFilter active={activeCategories} onToggle={toggleCategory} onSelectAll={selectAllCategories} />
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {sidebarContent}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          {plannerPois.length > 0 && mode === "explorer" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
              <button
                onClick={() => setMode("planner")}
                className="glass rounded-full px-4 py-1.5 border border-ocean-500/[0.4] bg-ocean-500/[0.18] shadow-glow flex items-center gap-2 hover:bg-ocean-500/[0.28] transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-ocean-400 animate-pulse" />
                <span className="text-ocean-300 text-xs font-semibold">
                  {plannerPois.length} stop{plannerPois.length !== 1 ? "s" : ""} · View Route
                </span>
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
        </div>

        {/* Desktop right panel */}
        {rightPanel !== null && (
          <div className="hidden md:flex w-80 flex-shrink-0 right-panel relative z-10 overflow-hidden flex-col">
            {rightPanelContent}
          </div>
        )}
      </div>

      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl" style={{ background: "oklch(0.18 0.028 250 / 0.96)", borderTop: "1px solid var(--line)" }}>
        <div className="flex items-center justify-around px-2 py-2">
          <button
            onClick={() => handleMobileNavMode("explorer")}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
              mode === "explorer" ? "text-ocean-300" : "text-slate-500"
            }`}
          >
            <span className="text-lg">🧭</span>
            <span>Explore</span>
          </button>

          <button
            onClick={() => handleMobileNavMode("planner")}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
              mode === "planner" ? "text-coral-400" : "text-slate-500"
            }`}
          >
            <span className="text-lg">🗺️</span>
            <span>Plan</span>
          </button>

          <button
            onClick={() => handleToggleRightPanel("passport")}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
              rightPanel === "passport" ? "text-ocean-300" : "text-slate-500"
            }`}
          >
            <span className="text-lg">📖</span>
            <span>Passport</span>
          </button>

          {mode === "planner" && (
            <button
              onClick={() => handleToggleRightPanel("ai")}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
                rightPanel === "ai" ? "text-purple-300" : "text-slate-500"
              }`}
            >
              <span className="text-lg">✨</span>
              <span>AI</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
