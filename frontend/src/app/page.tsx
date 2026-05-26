"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { POI, TransportMode, RouteSegment, Itinerary, LatLng } from "@/types";
import { ExplorerTitle } from "@/types/gamification";
import { usePOIs } from "@/hooks/usePOIs";
import { computeRoute, formatDistance, formatDuration } from "@/services/routing";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
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
import { OnboardingModal, isOnboardingDone } from "@/components/OnboardingModal";

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasPassportBadge, setHasPassportBadge] = useState(false);
  const [passportNudgeXP, setPassportNudgeXP] = useState<number | null>(null);

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

  useEffect(() => {
    if (!isOnboardingDone()) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    if (passportNudgeXP === null) return;
    const t = setTimeout(() => setPassportNudgeXP(null), 6000);
    return () => clearTimeout(t);
  }, [passportNudgeXP]);

  const handleModeChange = useCallback((newMode: "explorer" | "planner") => {
    if (newMode === "planner") {
      try {
        if (!localStorage.getItem("wandrmark:seen_planner_hint")) {
          showInfoToast("Add places from the map to build a route", "🗓️");
          localStorage.setItem("wandrmark:seen_planner_hint", "true");
        }
      } catch {}
    }
    setMode(newMode);
  }, []);

  const isOnline = useNetworkStatus();
  const { pois, loading, error, isCached, activeCategories, toggleCategory, selectAllCategories, load } = usePOIs();
  const { visitPOI, progress, visitedPoiIds, saveTripMemory } = useGamification();
  const mapMoveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref so handlePoiClick can read the current level without depending on
  // progress as a useCallback dep (progress changes on every POI visit, which would
  // invalidate handlePoiClick and force WayvMap + ExplorerSidebar to re-render).
  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; });

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

    if (result.leveledUp && result.newLevel && result.newLevelNum) {
      showLevelUpToast(result.newLevelNum, result.newLevel as ExplorerTitle);
      setLevelUpData({ level: result.newLevelNum, title: result.newLevel as ExplorerTitle });
    }

    if (isMobile) {
      try {
        if (!localStorage.getItem("wandrmark:seen_passport_nudge")) {
          setHasPassportBadge(true);
          setPassportNudgeXP(result.xpGained);
          localStorage.setItem("wandrmark:seen_passport_nudge", "true");
        }
      } catch {}
    }
  }, [visitPOI, isMobile]);

  const handleRetry = useCallback(() => load(mapCenter), [load, mapCenter]);

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
    setPlannerPois((prev) => {
      if (poi.id && prev.some((p) => p.id === poi.id)) {
        showInfoToast(`${poi.name || "Place"} is already in your plan`, "📍");
        return prev;
      }
      return [...prev, poi as POI];
    });
  }, []);

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
      showInfoToast(`Route ready — ${formatDistance(result.totalDistance)} · ${formatDuration(result.totalDuration)}`, "🗺️");
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : "Routing failed.");
    } finally {
      setRouteLoading(false);
    }
  }, [plannerPois, transportMode]);

  const handleSaveItinerary = useCallback((itinerary: Itinerary) => {
    const newAchievements = saveTripMemory({
      cityName: deriveCityName(itinerary.route.pois),
      poisVisited: itinerary.route.pois,
      route: itinerary.route.segments,
      distance: itinerary.route.totalDistance,
      duration: itinerary.route.totalDuration,
      notes: itinerary.name,
    });
    newAchievements.forEach((a) => showAchievementToast(a));
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
    setRightDrawerOpen((prev) => {
      if (!prev) {
        setHasPassportBadge(false);
        setPassportNudgeXP(null);
      }
      return !prev;
    });
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
      onRetry={handleRetry}
      activeCategories={activeCategories}
      onToggleCategory={toggleCategory}
      onSelectAllCategories={selectAllCategories}
      mapCenter={mapCenter}
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
      onGoToExplorer={() => handleModeChange("explorer")}
    />
  );

  return (
    <div className="app-layout">
      <a className="skip-link" href="#map">Skip to map</a>

      <AchievementToast />

      {!isOnline && (
        <div
          role="alert"
          style={{
            position: "fixed", top: 56, left: 0, right: 0, zIndex: 200,
            background: "rgba(10,15,23,0.95)", backdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(255,161,74,0.35)",
            padding: "8px 16px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
          <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--orange)", letterSpacing: "0.04em" }}>
            {isCached ? "Offline — showing cached places" : "You're offline"}
          </span>
        </div>
      )}

      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}

      {passportNudgeXP !== null && isMobile && (
        <button
          onClick={() => {
            setRightDrawerOpen(true);
            setHasPassportBadge(false);
            setPassportNudgeXP(null);
          }}
          className="animate-slide-in-right"
          aria-label="Open passport to see your XP"
          style={{
            position: "fixed", top: "64px", right: "12px", zIndex: 49,
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "10px 14px", borderRadius: "12px", minHeight: "44px",
            background: "rgba(10,15,23,0.90)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(95,227,255,0.35)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35), 0 0 16px rgba(95,227,255,0.08)",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "15px", lineHeight: 1 }}>🎖️</span>
          <span style={{ fontFamily: "var(--font)", fontSize: "12.5px", color: "var(--ink-2)", whiteSpace: "nowrap" }}>
            <span style={{ color: "var(--cyan)", fontWeight: 700, fontFamily: "var(--mono)" }}>+{passportNudgeXP} XP</span>
            {" "}· Tap to see your Passport
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

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
        onModeChange={handleModeChange}
        rightDrawerOpen={rightDrawerOpen}
        onToggleRightDrawer={handleToggleRightDrawer}
        hasPassportBadge={hasPassportBadge}
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
                  padding: "7px 14px", borderRadius: "99px", minHeight: "44px",
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
              onClick={() => { setAiPanelOpen(true); if (mode === "explorer") handleModeChange("planner"); }}
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
