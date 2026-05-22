"use client";
import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { POI } from "@/types";
import { CATEGORY_CONFIG } from "@/utils/constants";
import { useFavorites } from "@/hooks/useFavorites";
import { geocodeSearch } from "@/services/nominatim";
import { aiApi, CityInsights } from "@/services/api";

const SEARCH_HISTORY_KEY = "wandrmark:search-history";
const MAX_HISTORY = 5;

function loadHistory(): string[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToHistory(query: string): void {
  try {
    if (typeof window === "undefined") return;
    const prev = loadHistory();
    const updated = [query, ...prev.filter((h) => h !== query)].slice(0, MAX_HISTORY);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

function clearHistory(): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {}
}

interface SearchResult {
  name: string;
  region: string;
  lat: number;
  lng: number;
}

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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [insightCityName, setInsightCityName] = useState("");
  const [cityInsights, setCityInsights] = useState<CityInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [slide, setSlide] = useState(0);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const insightAbort = useRef<AbortController | null>(null);
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  useEffect(() => {
    setSearchHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (!insightCityName) return;
    insightAbort.current?.abort();
    insightAbort.current = new AbortController();
    const { signal } = insightAbort.current;
    setCityInsights(null);
    setInsightsLoading(true);
    setSlide(0);
    aiApi.getCityInsights(insightCityName)
      .then((data) => { if (!signal.aborted) setCityInsights(data); })
      .catch(() => { if (!signal.aborted) setCityInsights(null); })
      .finally(() => { if (!signal.aborted) setInsightsLoading(false); });
    return () => { insightAbort.current?.abort(); };
  }, [insightCityName]);

  const runSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchResults([]);
    setShowDropdown(false);
    setFocusedIdx(-1);
    try {
      const results = await geocodeSearch(q, 5);
      setSearchResults(results.map((r) => ({
        name: r.shortName, region: r.region,
        lat: r.coordinates.lat, lng: r.coordinates.lng,
      })));
      setShowDropdown(true);
      saveToHistory(q);
      setSearchHistory(loadHistory());
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const selectResult = useCallback((r: SearchResult) => {
    onSearchResult(r.lat, r.lng);
    setInsightCityName(r.name);
    setSearchResults([]);
    setShowDropdown(false);
    setSearch("");
    setSlide(0);
    setFocusedIdx(-1);
  }, [onSearchResult]);

  const selectHistoryItem = useCallback((item: string) => {
    setSearch(item);
    setShowDropdown(false);
    setFocusedIdx(-1);
    runSearch(item);
  }, [runSearch]);

  const isShowingResults = showDropdown && searchResults.length > 0;
  const isShowingHistory = showDropdown && searchResults.length === 0 && searchHistory.length > 0 && !search.trim();
  const dropdownLen = isShowingResults ? searchResults.length : (isShowingHistory ? searchHistory.length : 0);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIdx >= 0 && isShowingResults) {
        selectResult(searchResults[focusedIdx]);
      } else if (focusedIdx >= 0 && isShowingHistory) {
        selectHistoryItem(searchHistory[focusedIdx]);
      } else {
        runSearch(search);
      }
      return;
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
      setFocusedIdx(-1);
      return;
    }
    if (dropdownLen === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((prev) => (prev + 1) % dropdownLen);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((prev) => (prev <= 0 ? dropdownLen - 1 : prev - 1));
    }
  };

  const filteredPois = search.trim()
    ? pois.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : pois;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="flex-shrink-0" style={{ padding: "4px 14px 12px", borderBottom: "1px solid var(--line)" }}>
        <div className="flex gap-2">
          <div style={{ flex: 1, position: "relative" }}>
            <svg
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: "var(--ink-3)", pointerEvents: "none" }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              className="input-glass"
              type="text"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (!val.trim()) { setSearchResults([]); setFocusedIdx(-1); }
              }}
              onFocus={() => { setShowDropdown(true); setFocusedIdx(-1); }}
              onBlur={() => setTimeout(() => { setShowDropdown(false); setFocusedIdx(-1); }, 150)}
              onKeyDown={handleKeyDown}
              placeholder="Search cities or places…"
              style={{ paddingLeft: "36px", height: "38px" }}
            />
          </div>
          <button
            onClick={() => runSearch(search)}
            disabled={searchLoading || !search.trim()}
            style={{
              height: "38px", padding: "0 14px",
              background: "linear-gradient(180deg, oklch(0.32 0.06 205), oklch(0.24 0.05 205))",
              border: "1px solid oklch(0.55 0.12 205 / 0.6)",
              color: "var(--cyan)", fontWeight: 600, fontSize: "13px",
              borderRadius: "10px", cursor: "pointer",
              opacity: (searchLoading || !search.trim()) ? 0.4 : 1,
              transition: "opacity 150ms ease",
              flexShrink: 0,
            }}
          >
            {searchLoading ? (
              <span className="w-4 h-4 rounded-full border-2 animate-spin block" style={{ borderColor: "var(--cyan)", borderTopColor: "transparent" }} />
            ) : "Go"}
          </button>
        </div>

        {/* Search history dropdown */}
        {isShowingHistory && (
          <div style={{ marginTop: "8px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "6px 12px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)" }}>Recent</span>
              <button
                onMouseDown={() => { clearHistory(); setSearchHistory([]); setShowDropdown(false); }}
                style={{ fontSize: "10px", color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: "4px" }}
              >
                Clear
              </button>
            </div>
            {searchHistory.map((item, i) => (
              <button
                key={i}
                onMouseDown={() => selectHistoryItem(item)}
                className="w-full text-left"
                style={{
                  padding: "8px 12px",
                  borderTop: "1px solid var(--line)",
                  display: "flex", alignItems: "center", gap: "8px",
                  background: focusedIdx === i ? "oklch(0.28 0.04 250)" : "transparent",
                  transition: "background 120ms ease",
                  cursor: "pointer",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>{item}</span>
              </button>
            ))}
          </div>
        )}

        {/* Geocode results dropdown */}
        {isShowingResults && (
          <div style={{ marginTop: "8px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
            {searchResults.map((r, i) => (
              <button
                key={i}
                onMouseDown={() => selectResult(r)}
                className="w-full text-left"
                style={{
                  padding: "10px 12px",
                  borderBottom: i < searchResults.length - 1 ? "1px solid var(--line)" : "none",
                  display: "flex", alignItems: "center", gap: "10px",
                  background: focusedIdx === i ? "oklch(0.28 0.04 250)" : "transparent",
                  transition: "background 120ms ease",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setFocusedIdx(i)}
                onMouseLeave={() => setFocusedIdx(-1)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="10" r="3"/><path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12Z"/>
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

      {/* Error banner */}
      {error && (
        <div
          className="flex-shrink-0 flex items-center justify-between gap-2"
          style={{ margin: "8px 14px 0", padding: "10px 12px", background: "oklch(0.28 0.10 22 / 0.12)", border: "1px solid oklch(0.5 0.12 22 / 0.3)", borderRadius: "10px" }}
        >
          <p style={{ fontSize: "12px", color: "var(--coral)", lineHeight: 1.5, flex: 1 }}>{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{ color: "var(--coral)", fontSize: "11px", fontWeight: 600, flexShrink: 0, textDecoration: "underline", textUnderlineOffset: "2px", background: "none", border: "none", cursor: "pointer" }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">

        {/* City insights card */}
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
            <div style={{ margin: "8px 8px 4px", borderRadius: "14px", border: "1px solid var(--line)", background: "linear-gradient(180deg, var(--panel-2), var(--panel))", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--coral)", boxShadow: "0 0 6px var(--coral)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--coral)", flexShrink: 0 }}>Exploring</span>
                  <span style={{ width: "1px", height: "10px", background: "var(--line)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "13px", letterSpacing: "-0.01em", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {insightCityName}
                  </span>
                </div>
                {!insightsLoading && total > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                    <button onClick={() => goTo((slide - 1 + total) % total)} style={{ width: "24px", height: "24px", borderRadius: "7px", display: "grid", placeItems: "center", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--ink-3)", cursor: "pointer", fontSize: "11px", transition: "background 120ms ease" }}>‹</button>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "var(--ink-4)", minWidth: "24px", textAlign: "center" }}>{slide + 1}/{total}</span>
                    <button onClick={() => goTo((slide + 1) % total)} style={{ width: "24px", height: "24px", borderRadius: "7px", display: "grid", placeItems: "center", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--ink-3)", cursor: "pointer", fontSize: "11px", transition: "background 120ms ease" }}>›</button>
                  </div>
                )}
              </div>

              {/* Slide */}
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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "13px" }}>{s.emoji}</span>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.02em", color: s.accent, textTransform: "uppercase" }}>{s.label}</span>
                      </div>
                      {s.key === "about" && <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.6 }}>{cityInsights.overview}</p>}
                      {s.key === "known" && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {cityInsights.highlights.map((h, i) => (
                            <span key={i} style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "11px", color: "var(--orchid)", background: "oklch(0.22 0.04 295 / 0.5)", border: "1px solid oklch(0.4 0.10 295 / 0.35)" }}>{h}</span>
                          ))}
                        </div>
                      )}
                      {s.key === "history" && <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.6 }}>{cityInsights.historicalFact}</p>}
                      {s.key === "tip" && <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.6 }}>{cityInsights.localTip}</p>}
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
                      style={{ width: i === slide ? "16px" : "5px", height: "5px", borderRadius: "99px", background: i === slide ? slides[slide].accent : "var(--line-2)", border: "none", padding: 0, cursor: "pointer", transition: "all 250ms ease" }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "10px", padding: "8px", alignItems: "center" }}>
                <div className="skeleton" style={{ width: "36px", height: "36px", borderRadius: "10px" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div className="skeleton" style={{ height: "12px", borderRadius: "99px", width: "75%" }} />
                  <div className="skeleton" style={{ height: "10px", borderRadius: "99px", width: "50%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredPois.length === 0 && !error && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center", gap: "8px" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "16px", marginBottom: "4px", display: "grid", placeItems: "center", fontSize: "24px", background: "var(--panel)", border: "1px solid var(--line)" }}>
              🗺️
            </div>
            <p style={{ color: "var(--ink-2)", fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em" }}>
              {search.trim() ? "No matches" : "No places found"}
            </p>
            <p style={{ color: "var(--ink-3)", fontSize: "12px", lineHeight: 1.5 }}>
              {search.trim() ? "Try a different keyword" : "Move the map or search a city to load places"}
            </p>
          </div>
        )}

        {/* POI list */}
        {!loading && filteredPois.length > 0 && (
          <div style={{ padding: "0 10px 18px" }}>
            {/* Count label */}
            <div style={{ padding: "8px 8px 4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                {filteredPois.length} place{filteredPois.length !== 1 ? "s" : ""} nearby
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
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
                      padding: "8px", borderRadius: "10px",
                      cursor: "pointer", border: "1px solid transparent",
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "oklch(0.24 0.03 250)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    onClick={() => onPoiClick(poi)}
                  >
                    {/* Category icon */}
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", display: "grid", placeItems: "center", background: `${cfg.markerColor}22`, border: `1px solid ${cfg.markerColor}44`, fontSize: "16px", flexShrink: 0 }}>
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

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                      {/* Favorite: always visible when active, otherwise on hover */}
                      <button
                        onClick={(e) => { e.stopPropagation(); fav ? removeFavorite(poi.id) : addFavorite(poi); }}
                        className={fav ? undefined : "opacity-0 group-hover:opacity-100 transition-opacity"}
                        style={{ padding: "6px", borderRadius: "8px", fontSize: "13px", color: fav ? "var(--coral)" : "var(--ink-3)", background: "transparent", border: "none", cursor: "pointer", transition: "color 120ms ease" }}
                        title={fav ? "Remove from favorites" : "Add to favorites"}
                      >
                        {fav ? "♥" : "♡"}
                      </button>
                      {/* Add to planner: show on hover */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToPlanner(poi); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ padding: "5px 7px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "var(--ink-3)", background: "transparent", border: "none", cursor: "pointer", transition: "color 120ms ease" }}
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
        )}
      </div>
    </div>
  );
}
