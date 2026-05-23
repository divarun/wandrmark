"use client";
import { memo, useState, useEffect } from "react";
import { POI, TransportMode, RouteSegment, Itinerary, Route } from "@/types";
import { TRANSPORT_MODES } from "@/utils/constants";
import { formatDistance, formatDuration } from "@/services/routing";
import { exportItineraryJSON, exportItineraryPDF } from "@/utils/export";
import { localItineraries } from "@/services/localStorage";
import { aiApi } from "@/services/api";
import { showInfoToast } from "@/components/AchievementToast";

interface PlannerSidebarProps {
  plannerPois: POI[];
  transportMode: TransportMode;
  onModeChange: (mode: TransportMode) => void;
  onRemovePoi: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onComputeRoute: () => void;
  routeSegments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  routeLoading: boolean;
  routeError: string | null;
  onClear: () => void;
  onSaveItinerary?: (itinerary: Itinerary) => void;
  onGoToExplorer?: () => void;
}

function extractCityName(pois: POI[]): string {
  if (pois.length === 0) return "Your Trip";
  const parts = pois[0].address.split(",");
  return parts[parts.length >= 3 ? parts.length - 2 : 0]?.trim() || "Your Trip";
}

function extractNeighborhoods(pois: POI[]): string[] {
  return [...new Set(pois.map(p => p.address.split(",")[0]?.trim()).filter(Boolean))];
}

function PlannerSidebarInner({
  plannerPois,
  transportMode,
  onModeChange,
  onRemovePoi,
  onReorder,
  onComputeRoute,
  routeSegments,
  totalDistance,
  totalDuration,
  routeLoading,
  routeError,
  onClear,
  onSaveItinerary,
  onGoToExplorer,
}: PlannerSidebarProps) {
  const [itineraryName, setItineraryName] = useState("My Trip");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [savedItineraries, setSavedItineraries] = useState<Itinerary[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [tripStory, setTripStory] = useState<string | null>(null);
  const [tripStoryLoading, setTripStoryLoading] = useState(false);

  useEffect(() => {
    setSavedItineraries(localItineraries.getAll());
  }, []);

  const buildItinerary = (): Itinerary => {
    const route: Route = {
      id: Date.now().toString(),
      segments: routeSegments,
      totalDistance,
      totalDuration,
      transportMode,
      createdAt: Date.now(),
      pois: plannerPois,
    };
    return {
      id: Date.now().toString(),
      name: itineraryName,
      route,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  };

  const handleSave = async () => {
    const itinerary = buildItinerary();
    localItineraries.add(itinerary);
    setSavedItineraries(localItineraries.getAll());
    onSaveItinerary?.(itinerary);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
    showInfoToast(`"${itinerary.name}" saved to your trips`, "💾");

    // Generate AI trip story in background — non-blocking
    if (plannerPois.length >= 2) {
      setTripStory(null);
      setTripStoryLoading(true);
      try {
        const cityName = extractCityName(plannerPois);
        const neighborhoods = extractNeighborhoods(plannerPois);
        const result = await aiApi.getCitySummary(cityName, neighborhoods, plannerPois.length);
        setTripStory(result.summary);
      } catch {
        // AI summary is optional — fail silently
      } finally {
        setTripStoryLoading(false);
      }
    }
  };

  const handleDeleteSaved = (id: string) => {
    localItineraries.remove(id);
    setSavedItineraries(localItineraries.getAll());
  };

  const handleCopyText = () => {
    const modeLabel = { walk: "Walking", bike: "Cycling", car: "Driving", transit: "Transit" }[transportMode];
    const stops = plannerPois.map((p, i) => `${i + 1}. ${p.name} — ${p.address}`).join("\n");
    const text = `Wandrmark Trip: ${itineraryName}\n\n${stops}\n\nTotal: ${formatDistance(totalDistance)} · ${formatDuration(totalDuration)} · ${modeLabel}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    onReorder(dragIdx, targetIdx);
    setDragIdx(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0" style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", flex: 1 }}>
            {TRANSPORT_MODES.map((tm) => {
              const isActive = transportMode === tm.id;
              return (
                <button
                  key={tm.id}
                  onClick={() => onModeChange(tm.id)}
                  aria-selected={isActive}
                  title={tm.label}
                  style={{
                    appearance: "none", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
                    padding: "11px 6px 9px",
                    border: `1px solid ${isActive ? "rgba(255,161,74,0.45)" : "var(--line-2)"}`,
                    borderRadius: "11px",
                    color: isActive ? "var(--orange)" : "var(--ink-3)",
                    background: isActive
                      ? "linear-gradient(180deg, rgba(255,161,74,0.12), rgba(255,161,74,0.02))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
                    boxShadow: isActive ? "inset 0 0 0 1px rgba(255,161,74,0.22), 0 0 16px rgba(255,161,74,0.10)" : "none",
                    transition: "all 0.12s ease",
                  }}
                >
                  <span style={{ fontSize: "16px", lineHeight: 1 }}>{tm.emoji}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: isActive ? "var(--orange)" : "var(--ink-4)" }}>
                    {tm.label}
                  </span>
                </button>
              );
            })}
          </div>
          {plannerPois.length > 0 && (
            confirmingClear ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <span style={{ fontSize: "11px", color: "var(--ink-3)", whiteSpace: "nowrap" }}>Clear all?</span>
                <button
                  onClick={() => { onClear(); setConfirmingClear(false); }}
                  style={{ padding: "4px 8px", borderRadius: "7px", background: "oklch(0.28 0.08 22 / 0.25)", border: "1px solid oklch(0.5 0.12 22 / 0.5)", color: "var(--coral)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmingClear(false)}
                  style={{ padding: "4px 8px", borderRadius: "7px", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--ink-3)", fontSize: "11px", fontWeight: 500, cursor: "pointer" }}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingClear(true)}
                style={{ padding: "5px 10px", borderRadius: "8px", background: "oklch(0.28 0.08 22 / 0.2)", border: "1px solid oklch(0.5 0.12 22 / 0.4)", color: "var(--coral)", fontSize: "11px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              >
                Clear
              </button>
            )
          )}
        </div>
      </div>

      {/* Stop list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {plannerPois.length === 0 && (
          <div style={{
            margin: "4px 0 12px",
            padding: "30px 18px 26px",
            border: "1px dashed var(--line-3)",
            borderRadius: "14px",
            textAlign: "center",
            background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.012) 0 6px, transparent 6px 12px), linear-gradient(180deg, rgba(255,107,111,0.04), transparent 70%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
          }}>
            <div style={{ position: "relative", width: "48px", height: "48px", borderRadius: "50%", display: "inline-grid", placeItems: "center", background: "radial-gradient(circle at 50% 40%, rgba(255,107,111,0.18), rgba(255,107,111,0))", color: "var(--coral)", marginBottom: "8px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(255,107,111,0.35)", animation: "ping 2.4s ease-out infinite" }} />
            </div>
            <p style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--ink)", letterSpacing: "-0.005em" }}>No stops yet</p>
            <p style={{ fontSize: "11.5px", color: "var(--ink-4)", lineHeight: 1.5 }}>
              Tap <kbd style={{ display: "inline-grid", placeItems: "center", background: "rgba(95,227,255,0.12)", border: "1px solid rgba(95,227,255,0.3)", color: "var(--cyan)", fontFamily: "var(--mono)", fontSize: "10px", padding: "2px 5px", borderRadius: "4px", margin: "0 1px" }}>+</kbd> on any place to add it
            </p>
            {onGoToExplorer && (
              <button
                onClick={onGoToExplorer}
                style={{
                  marginTop: "10px",
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "99px",
                  background: "linear-gradient(180deg, rgba(95,227,255,0.14), rgba(95,227,255,0.04))",
                  border: "1px solid rgba(95,227,255,0.35)",
                  color: "var(--cyan)", fontFamily: "var(--mono)", fontWeight: 600, fontSize: "11px",
                  letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Explore Places
              </button>
            )}
          </div>
        )}

        {plannerPois.map((poi, idx) => (
          <div
            key={poi.id}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing ${
              dragIdx === idx
                ? "opacity-40 border-ocean-500/40 bg-ocean-500/[0.08]"
                : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center flex-shrink-0 shadow-glow-sm">
              <span className="text-white text-[11px] font-bold">{idx + 1}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{poi.name}</p>
              <p className="text-slate-500 text-[10px] truncate capitalize">{poi.category}</p>
            </div>

            {routeSegments[idx - 1] && idx > 0 && (
              <span className="text-ocean-400 text-[10px] font-semibold flex-shrink-0">
                {formatDistance(routeSegments[idx - 1].distance)}
              </span>
            )}

            <button
              onClick={() => onRemovePoi(poi.id)}
              className="text-slate-600 hover:text-red-400 transition-colors p-0.5 rounded text-xs flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Saved itineraries */}
        {savedItineraries.length > 0 && (
          <div className="pt-3 mt-2 border-t border-white/[0.06]">
            <button
              onClick={() => setShowSaved(s => !s)}
              className="flex items-center justify-between w-full text-left mb-2"
            >
              <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide">
                Saved Trips ({savedItineraries.length})
              </span>
              <span className="text-slate-600 text-xs">{showSaved ? "▲" : "▼"}</span>
            </button>
            {showSaved && (
              <div className="space-y-1.5">
                {savedItineraries.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <span className="text-slate-500 text-sm flex-shrink-0">🗺️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-xs font-semibold truncate">{it.name}</p>
                      <p className="text-slate-600 text-[10px]">
                        {it.route.pois.length} stops · {formatDistance(it.route.totalDistance)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => exportItineraryJSON(it)}
                        className="text-slate-600 hover:text-ocean-400 transition-colors text-[10px] px-1.5 py-0.5 rounded border border-white/[0.06] hover:border-ocean-500/30"
                        title="Export JSON"
                      >
                        JSON
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(it.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-0.5 rounded text-xs"
                        title="Delete saved trip"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] p-3 space-y-2.5 flex-shrink-0">
        {totalDistance > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="stat-pill">
              <p className="section-label">Distance</p>
              <p className="text-ocean-300 font-bold text-sm">{formatDistance(totalDistance)}</p>
            </div>
            <div className="stat-pill">
              <p className="section-label">Duration</p>
              <p className="text-ocean-300 font-bold text-sm">{formatDuration(totalDuration)}</p>
            </div>
          </div>
        )}

        {routeError && (
          <div className="bg-red-500/[0.1] border border-red-500/[0.2] rounded-xl px-3 py-2">
            <p className="text-red-400 text-xs leading-relaxed">{routeError}</p>
          </div>
        )}

        {plannerPois.length >= 2 && (
          <button
            onClick={onComputeRoute}
            disabled={routeLoading}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {routeLoading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Computing…
              </>
            ) : (
              <>{routeSegments.length > 0 ? "Recompute Route" : "Compute Route"}</>
            )}
          </button>
        )}

        {routeSegments.length > 0 && (
          <>
            <input
              type="text"
              value={itineraryName}
              onChange={(e) => setItineraryName(e.target.value)}
              className="input-glass py-1.5 text-xs"
              placeholder="Trip name…"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleSave}
                className={`py-2 rounded-xl border text-[11px] font-semibold transition-all text-center ${
                  justSaved
                    ? "bg-emerald-500/[0.15] border-emerald-500/[0.35] text-emerald-400"
                    : "bg-ocean-500/[0.12] border-ocean-500/[0.25] text-ocean-300 hover:bg-ocean-500/[0.2]"
                }`}
              >
                {justSaved ? "✓ Saved!" : "💾 Save Trip"}
              </button>
              <button
                onClick={handleCopyText}
                className={`py-2 rounded-xl border text-[11px] font-semibold transition-all text-center ${
                  copied
                    ? "bg-emerald-500/[0.15] border-emerald-500/[0.35] text-emerald-400"
                    : "bg-white/[0.05] border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.09]"
                }`}
              >
                {copied ? "✓ Copied!" : "📋 Copy Text"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => exportItineraryJSON(buildItinerary())}
                className="py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.09] text-[11px] font-semibold transition-all text-center"
              >
                Export JSON
              </button>
              <button
                onClick={() => exportItineraryPDF(buildItinerary())}
                className="py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.09] text-[11px] font-semibold transition-all text-center"
              >
                Export PDF
              </button>
            </div>

            {/* AI Trip Story */}
            {(tripStoryLoading || tripStory) && (
              <div style={{ borderRadius: "12px", border: "1px solid oklch(0.4 0.10 295 / 0.35)", background: "oklch(0.22 0.04 295 / 0.4)", padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px" }}>✨</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--orchid)" }}>Trip Story</span>
                </div>
                {tripStoryLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div className="skeleton" style={{ height: "8px", borderRadius: "99px", width: "100%" }} />
                    <div className="skeleton" style={{ height: "8px", borderRadius: "99px", width: "80%" }} />
                    <div className="skeleton" style={{ height: "8px", borderRadius: "99px", width: "90%" }} />
                  </div>
                ) : (
                  <p style={{ fontSize: "11.5px", color: "var(--ink-2)", lineHeight: 1.6 }}>{tripStory}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const PlannerSidebar = memo(PlannerSidebarInner);
export default PlannerSidebar;
