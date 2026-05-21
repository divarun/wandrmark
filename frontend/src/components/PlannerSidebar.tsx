"use client";
import { useState, useEffect } from "react";
import { POI, TransportMode, RouteSegment, Itinerary, Route } from "@/types";
import { TRANSPORT_MODES } from "@/utils/constants";
import { formatDistance, formatDuration } from "@/services/routing";
import { exportItineraryJSON, exportItineraryPDF } from "@/utils/export";
import { localItineraries } from "@/services/localStorage";

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
}

export default function PlannerSidebar({
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
}: PlannerSidebarProps) {
  const [itineraryName, setItineraryName] = useState("My Trip");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [savedItineraries, setSavedItineraries] = useState<Itinerary[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

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

  const handleSave = () => {
    const itinerary = buildItinerary();
    localItineraries.add(itinerary);
    setSavedItineraries(localItineraries.getAll());
    onSaveItinerary?.(itinerary);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
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
                  title={tm.label}
                  style={isActive ? {
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                    padding: "10px 6px 8px",
                    background: "linear-gradient(180deg, oklch(0.32 0.10 70 / 0.7), oklch(0.24 0.08 70 / 0.7))",
                    border: "1px solid oklch(0.6 0.14 70)",
                    borderRadius: "12px",
                    color: "var(--amber)",
                    boxShadow: "0 6px 14px -6px oklch(0.6 0.14 70 / 0.5)",
                    cursor: "pointer", transition: "all 150ms ease",
                  } : {
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                    padding: "10px 6px 8px",
                    background: "var(--panel)", border: "1px solid var(--line)",
                    borderRadius: "12px", color: "var(--ink-2)",
                    cursor: "pointer", transition: "all 150ms ease",
                  }}
                >
                  <span style={{ fontSize: "15px" }}>{tm.emoji}</span>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "11.5px", fontWeight: 600, letterSpacing: "-0.005em",
                  }}>
                    {tm.label.slice(0, 4)}
                  </span>
                </button>
              );
            })}
          </div>
          {plannerPois.length > 0 && (
            <button
              onClick={onClear}
              style={{
                padding: "5px 10px", borderRadius: "8px",
                background: "oklch(0.28 0.08 22 / 0.2)",
                border: "1px solid oklch(0.5 0.12 22 / 0.4)",
                color: "var(--coral)", fontSize: "11px", fontWeight: 600,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Stop list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {plannerPois.length === 0 && (
          <div style={{
            margin: "8px 4px 8px",
            padding: "28px 18px",
            border: "1.5px dashed var(--line-2)",
            borderRadius: "16px",
            textAlign: "center",
            background: "oklch(0.20 0.03 250 / 0.4)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
          }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "14px",
              display: "grid", placeItems: "center",
              background: "linear-gradient(180deg, oklch(0.32 0.10 22 / 0.5), oklch(0.22 0.06 22 / 0.5))",
              border: "1px solid oklch(0.5 0.14 22 / 0.4)",
              color: "var(--coral)", marginBottom: "6px", fontSize: "24px",
            }}>
              📍
            </div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              No stops yet
            </p>
            <p style={{ fontSize: "12px", color: "var(--ink-3)" }}>
              Tap <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", padding: "1px 6px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "5px", color: "var(--ink-2)" }}>+</span> on any place to add it
            </p>
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
          </>
        )}
      </div>
    </div>
  );
}
