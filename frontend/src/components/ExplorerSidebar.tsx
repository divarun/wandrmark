"use client";
import { useState, useEffect, useRef } from "react";
import { POI } from "@/types";
import { CATEGORY_CONFIG } from "@/utils/constants";
import { useFavorites } from "@/hooks/useFavorites";
import { geocodeSearch } from "@/services/nominatim";
import { aiApi, CityInsights } from "@/services/api";

interface ExplorerSidebarProps {
  pois: POI[];
  loading: boolean;
  error: string | null;
  onPoiClick: (poi: POI) => void;
  onSearchResult: (lat: number, lng: number) => void;
  onAddToPlanner: (poi: POI) => void;
  onRetry?: () => void;
}

export default function ExplorerSidebar({
  pois,
  loading,
  error,
  onPoiClick,
  onSearchResult,
  onAddToPlanner,
  onRetry,
}: ExplorerSidebarProps) {
  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ name: string; region: string; lat: number; lng: number }[]>([]);
  const [insightCityName, setInsightCityName] = useState("");
  const [cityInsights, setCityInsights] = useState<CityInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(true);
  const [slide, setSlide] = useState(0);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const insightAbort = useRef<AbortController | null>(null);
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  useEffect(() => {
    if (!insightCityName) return;

    insightAbort.current?.abort();
    insightAbort.current = new AbortController();
    const { signal } = insightAbort.current;

    setCityInsights(null);
    setInsightsLoading(true);
    setInsightsExpanded(true);

    aiApi.getCityInsights(insightCityName)
      .then((data) => { if (!signal.aborted) setCityInsights(data); })
      .catch(() => { if (!signal.aborted) setCityInsights(null); })
      .finally(() => { if (!signal.aborted) setInsightsLoading(false); });

    return () => { insightAbort.current?.abort(); };
  }, [insightCityName]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const results = await geocodeSearch(search, 5);
      setSearchResults(
        results.map((r) => ({
          name: r.shortName,
          region: r.region,
          lat: r.coordinates.lat,
          lng: r.coordinates.lng,
        }))
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const filteredPois = search.trim()
    ? pois.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : pois;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="flex-shrink-0" style={{ padding: "4px 14px 12px", borderBottom: "1px solid var(--line)" }}>
        <div className="flex gap-2">
          <div style={{ flex: 1, position: "relative" }}>
            <svg
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "var(--ink-3)", pointerEvents: "none" }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7"/>
              <path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (!e.target.value.trim()) setSearchResults([]); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search cities or places…"
              style={{
                width: "100%", height: "38px",
                background: "var(--panel)", border: "1px solid var(--line)",
                borderRadius: "10px", color: "var(--ink)",
                padding: "0 12px 0 36px",
                fontFamily: "inherit", fontSize: "13px", outline: "none",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--cyan-soft)"; e.target.style.boxShadow = "0 0 0 3px oklch(0.55 0.12 205 / 0.15)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searchLoading || !search.trim()}
            style={{
              height: "38px", padding: "0 14px",
              background: "linear-gradient(180deg, oklch(0.32 0.06 205), oklch(0.24 0.05 205))",
              border: "1px solid oklch(0.55 0.12 205 / 0.6)",
              color: "var(--cyan)", fontWeight: 600, fontSize: "13px",
              borderRadius: "10px", cursor: "pointer",
              opacity: (searchLoading || !search.trim()) ? 0.4 : 1,
            }}
          >
            {searchLoading ? (
              <span className="w-4 h-4 rounded-full border-2 animate-spin block" style={{ borderColor: "var(--cyan)", borderTopColor: "transparent" }} />
            ) : "Go"}
          </button>
        </div>

        {/* Geocode dropdown */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: "8px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => { onSearchResult(r.lat, r.lng); setInsightCityName(r.name); setSearchResults([]); setSearch(""); setSlide(0); }}
                className="w-full text-left"
                style={{
                  padding: "10px 12px",
                  borderBottom: i < searchResults.length - 1 ? "1px solid var(--line)" : "none",
                  display: "flex", alignItems: "center", gap: "10px",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "oklch(0.28 0.04 250)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="10" r="3"/>
                  <path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12Z"/>
                </svg>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  {r.region && <span style={{ fontSize: "11px", color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.region}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex-shrink-0 flex items-center justify-between gap-2"
          style={{ margin: "8px 14px 0", padding: "10px 12px", background: "oklch(0.28 0.10 22 / 0.12)", border: "1px solid oklch(0.5 0.12 22 / 0.3)", borderRadius: "10px" }}
        >
          <p style={{ fontSize: "12px", color: "var(--coral)", lineHeight: 1.5, flex: 1 }}>{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{ color: "var(--coral)", fontSize: "11px", fontWeight: 600, flexShrink: 0, textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* POI list */}
      <div className="flex-1 overflow-y-auto">

        {/* City Insights — swipeable card */}
        {insightCityName && (insightsLoading || cityInsights) && (() => {
          const slides = cityInsights ? [
            { key: "about",   label: "About",     emoji: "📍", accent: "var(--coral)" },
            { key: "known",   label: "Known for", emoji: "✨", accent: "var(--orchid)" },
            { key: "history", label: "History",   emoji: "🏛️", accent: "var(--amber)" },
            { key: "tip",     label: "Local tip", emoji: "💡", accent: "var(--mint)" },
          ] : [];
          const total = slides.length;
          const goTo = (idx: number) => {
            setSlideDir(idx > slide ? "right" : "left");
            setSlide(idx);
          };

          return (
            <div style={{
              margin: "8px 8px 4px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              background: "linear-gradient(180deg, var(--panel-2), var(--panel))",
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--coral)", boxShadow: "0 0 6px var(--coral)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--coral)", flexShrink: 0 }}>
                    Exploring
                  </span>
                  <span style={{ width: "1px", height: "10px", background: "var(--line)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "13px", letterSpacing: "-0.01em", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {insightCityName}
                  </span>
                </div>
                {!insightsLoading && total > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                    <button
                      onClick={() => goTo((slide - 1 + total) % total)}
                      style={{ width: "22px", height: "22px", borderRadius: "6px", display: "grid", placeItems: "center", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--ink-3)", cursor: "pointer", fontSize: "10px" }}
                    >‹</button>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "var(--ink-4)", minWidth: "24px", textAlign: "center" }}>
                      {slide + 1}/{total}
                    </span>
                    <button
                      onClick={() => goTo((slide + 1) % total)}
                      style={{ width: "22px", height: "22px", borderRadius: "6px", display: "grid", placeItems: "center", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--ink-3)", cursor: "pointer", fontSize: "10px" }}
                    >›</button>
                  </div>
                )}
              </div>

              {/* Slide content */}
              <div style={{ borderTop: "1px solid var(--line)" }}>
                {insightsLoading ? (
                  <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <div className="skeleton" style={{ width: "16px", height: "16px", borderRadius: "4px" }} />
                      <div className="skeleton" style={{ width: "60px", height: "9px", borderRadius: "99px" }} />
                    </div>
                    <div className="skeleton" style={{ height: "9px", borderRadius: "99px", width: "100%" }} />
                    <div className="skeleton" style={{ height: "9px", borderRadius: "99px", width: "85%" }} />
                    <div className="skeleton" style={{ height: "9px", borderRadius: "99px", width: "70%" }} />
                  </div>
                ) : cityInsights && slides[slide] ? (() => {
                  const s = slides[slide];
                  const animClass = slideDir === "right" ? "animate-slide-in-right" : "animate-slide-in-left";
                  return (
                    <div key={`${slide}-${insightCityName}`} className={animClass} style={{ padding: "12px 14px" }}>
                      {/* Slide label */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "13px" }}>{s.emoji}</span>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.02em", color: s.accent, textTransform: "uppercase" }}>
                          {s.label}
                        </span>
                      </div>

                      {/* Slide body */}
                      {s.key === "about" && (
                        <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                          {cityInsights.overview}
                        </p>
                      )}
                      {s.key === "known" && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {cityInsights.highlights.map((h, i) => (
                            <span key={i} style={{
                              padding: "4px 10px", borderRadius: "999px",
                              fontSize: "11px", color: "var(--orchid)",
                              background: "oklch(0.22 0.04 295 / 0.5)",
                              border: "1px solid oklch(0.4 0.10 295 / 0.35)",
                            }}>{h}</span>
                          ))}
                        </div>
                      )}
                      {s.key === "history" && (
                        <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                          {cityInsights.historicalFact}
                        </p>
                      )}
                      {s.key === "tip" && (
                        <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                          {cityInsights.localTip}
                        </p>
                      )}
                    </div>
                  );
                })() : null}
              </div>

              {/* Dot indicators */}
              {!insightsLoading && total > 0 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "5px", padding: "6px 0 8px" }}>
                  {slides.map((s, i) => (
                    <button
                      key={s.key}
                      onClick={() => goTo(i)}
                      style={{
                        width: i === slide ? "16px" : "5px",
                        height: "5px", borderRadius: "99px",
                        background: i === slide ? slides[slide].accent : "var(--line-2)",
                        border: "none", padding: 0, cursor: "pointer",
                        transition: "all 250ms ease",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {loading && (
          <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "10px", padding: "8px 8px", alignItems: "center" }}>
                <div className="skeleton" style={{ width: "36px", height: "36px", borderRadius: "10px" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div className="skeleton" style={{ height: "12px", borderRadius: "99px", width: "75%" }} />
                  <div className="skeleton" style={{ height: "10px", borderRadius: "99px", width: "50%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredPois.length === 0 && !error && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "14px", marginBottom: "12px",
              display: "grid", placeItems: "center", fontSize: "22px",
              background: "var(--panel)", border: "1px solid var(--line)",
            }}>
              🗺️
            </div>
            <p style={{ color: "var(--ink-2)", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>No places found</p>
            <p style={{ color: "var(--ink-3)", fontSize: "12px" }}>Adjust filters or search a different area</p>
          </div>
        )}

        <div style={{ padding: "0 10px 18px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {filteredPois.map((poi, i) => {
            const cfg = CATEGORY_CONFIG[poi.category];
            const fav = isFavorite(poi.id);
            return (
              <div
                key={poi.id}
                className={`group animate-fade-in stagger-${Math.min(i + 1, 5)}`}
                style={{
                  display: "grid", gridTemplateColumns: "36px 1fr auto",
                  alignItems: "center", gap: "10px",
                  padding: "8px 8px", borderRadius: "10px",
                  cursor: "pointer", border: "1px solid transparent",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "oklch(0.24 0.03 250)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                onClick={() => onPoiClick(poi)}
              >
                {/* Category icon */}
                <div
                  style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    display: "grid", placeItems: "center",
                    background: `${cfg.markerColor}22`,
                    border: `1px solid ${cfg.markerColor}44`,
                    fontSize: "16px",
                  }}
                >
                  {cfg.emoji}
                </div>

                {/* Info */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                    {poi.name}
                  </p>
                  <p style={{ fontSize: "11.5px", color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>
                    {poi.address}
                  </p>
                  {poi.rating && (
                    <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                      <span style={{ color: "var(--gold)", fontSize: "10px" }}>★</span>
                      <span style={{ fontSize: "10px", color: "var(--ink-3)" }}>{poi.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Hover actions */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); fav ? removeFavorite(poi.id) : addFavorite(poi); }}
                    style={{
                      padding: "6px", borderRadius: "8px", fontSize: "13px",
                      color: fav ? "var(--coral)" : "var(--ink-3)",
                      background: "transparent", border: "none", cursor: "pointer",
                      transition: "color 120ms ease",
                    }}
                    title={fav ? "Remove from favorites" : "Add to favorites"}
                  >
                    {fav ? "♥" : "♡"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToPlanner(poi); }}
                    style={{
                      padding: "6px", borderRadius: "8px", fontSize: "15px", fontWeight: 700,
                      color: "var(--ink-3)", background: "transparent", border: "none", cursor: "pointer",
                      transition: "color 120ms ease",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--cyan)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; }}
                    title="Add to planner"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
