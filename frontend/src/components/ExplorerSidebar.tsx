"use client";
import { memo, useState, useEffect, useRef, useCallback, useMemo, KeyboardEvent } from "react";
import { POI, POICategory, LatLng } from "@/types";
import { useFavorites } from "@/hooks/useFavorites";
import { geocodeSearch } from "@/services/nominatim";
import { aiApi, CityInsights } from "@/services/api";
import { useVirtualizer } from "@/hooks/useVirtualizer";

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
  distanceKm?: number;
}

const ALL_CATEGORIES: POICategory[] = ["restaurant", "cafe", "attraction", "park", "museum"];

const CATEGORY_CONFIG: {
  cat: POICategory;
  label: string;
  color: string;
  glow: string;
  icon: React.ReactNode;
}[] = [
  {
    cat: "restaurant",
    label: "Eat",
    color: "#ff6b6f",
    glow: "rgba(255,107,111,0.18)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7a3 3 0 0 0 6 0V2"/><line x1="6" y1="9" x2="6" y2="22"/>
        <path d="M18 2v20"/><path d="M14 6c0-2 2-4 4-4"/>
      </svg>
    ),
  },
  {
    cat: "cafe",
    label: "Café",
    color: "#ffa14a",
    glow: "rgba(255,161,74,0.16)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
        <path d="M17 9h2a3 3 0 0 1 0 6h-2"/>
        <path d="M6 3v2M10 3v2M14 3v2"/>
      </svg>
    ),
  },
  {
    cat: "attraction",
    label: "Visit",
    color: "#b196ff",
    glow: "rgba(177,150,255,0.18)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
      </svg>
    ),
  },
  {
    cat: "park",
    label: "Park",
    color: "#5cdb95",
    glow: "rgba(92,219,149,0.16)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V12"/><path d="M5 12c0-4 3-7 7-7s7 3 7 7c0 2-1.5 4-3 4H8c-1.5 0-3-2-3-4Z"/>
      </svg>
    ),
  },
  {
    cat: "museum",
    label: "Arts",
    color: "#ff8fb7",
    glow: "rgba(255,143,183,0.16)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/>
        <line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/>
        <line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>
      </svg>
    ),
  },
];

const POI_ITEM_HEIGHT = 56; // px — keeps virtual positions accurate

const POI_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  restaurant: { color: "#ff6b6f", bg: "rgba(255,107,111,0.07)", border: "rgba(255,107,111,0.22)" },
  cafe:       { color: "#ffa14a", bg: "rgba(255,161,74,0.07)",  border: "rgba(255,161,74,0.22)"  },
  attraction: { color: "#b196ff", bg: "rgba(177,150,255,0.07)", border: "rgba(177,150,255,0.22)" },
  park:       { color: "#5cdb95", bg: "rgba(92,219,149,0.07)",  border: "rgba(92,219,149,0.22)"  },
  museum:     { color: "#ff8fb7", bg: "rgba(255,143,183,0.07)", border: "rgba(255,143,183,0.22)" },
};

// Stamped at build/deploy time; formatted in UTC so it's unambiguous on any client
const BUILD_LABEL = (() => {
  const raw = process.env.NEXT_PUBLIC_BUILD_TIME;
  if (!raw) return null;
  return new Intl.DateTimeFormat("en", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "UTC", timeZoneName: "short",
  }).format(new Date(raw));
})();

function formatDist(km?: number): string {
  if (km === undefined) return "";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
}

interface ExplorerSidebarProps {
  pois: POI[];
  loading: boolean;
  error: string | null;
  onPoiClick: (poi: POI) => void;
  onSearchResult: (lat: number, lng: number) => void;
  onAddToPlanner: (poi: POI) => void;
  onRetry?: () => void;
  activeCategories: POICategory[];
  onToggleCategory: (cat: POICategory) => void;
  onSelectAllCategories: () => void;
  mapCenter?: LatLng;
}

function ExplorerSidebarInner({
  pois,
  loading,
  error,
  onPoiClick,
  onSearchResult,
  onAddToPlanner,
  onRetry,
  activeCategories,
  onToggleCategory,
  onSelectAllCategories,
  mapCenter,
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
  const [insightsCollapsed, setInsightsCollapsed] = useState(true);
  const insightAbort = useRef<AbortController | null>(null);
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  const isAllActive = activeCategories.length === ALL_CATEGORIES.length;

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
    aiApi.getCityInsights(insightCityName, signal)
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
      const results = await geocodeSearch(q, 5, undefined, mapCenter);
      setSearchResults(results.map((r) => ({
        name: r.shortName, region: r.region,
        lat: r.coordinates.lat, lng: r.coordinates.lng,
        distanceKm: r.distanceKm,
      })));
      setShowDropdown(true);
      saveToHistory(q);
      setSearchHistory(loadHistory());
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [mapCenter]);

  const selectResult = useCallback((r: SearchResult) => {
    onSearchResult(r.lat, r.lng);
    setInsightCityName(r.name);
    setInsightsCollapsed(false);
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
      if (focusedIdx >= 0 && isShowingResults) selectResult(searchResults[focusedIdx]);
      else if (focusedIdx >= 0 && isShowingHistory) selectHistoryItem(searchHistory[focusedIdx]);
      else runSearch(search);
      return;
    }
    if (e.key === "Escape") { setShowDropdown(false); setFocusedIdx(-1); return; }
    if (dropdownLen === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((prev) => (prev + 1) % dropdownLen); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((prev) => (prev <= 0 ? dropdownLen - 1 : prev - 1)); }
  };

  const filteredPois = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? pois.filter((p) => p.name.toLowerCase().includes(q)) : pois;
  }, [pois, search]);

  const { containerRef: poiContainerRef, startIdx, endIdx, topPadding, bottomPadding } = useVirtualizer(
    filteredPois.length,
    POI_ITEM_HEIGHT
  );

  const slides = cityInsights ? [
    { key: "about",   label: "About",     color: "#ff6b6f", bg: "rgba(255,107,111,0.10)" },
    { key: "known",   label: "Known For", color: "#b196ff", bg: "rgba(177,150,255,0.10)" },
    { key: "history", label: "History",   color: "#ffa14a", bg: "rgba(255,161,74,0.10)" },
    { key: "tip",     label: "Local Tip", color: "#5cdb95", bg: "rgba(92,219,149,0.10)" },
  ] : [];

  const goTo = (idx: number) => {
    setSlideDir(idx > slide ? "right" : "left");
    setSlide(idx);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Category tabs */}
      <div style={{ padding: "10px 12px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "5px" }}>
          {/* All tab */}
          <button
            onClick={onSelectAllCategories}
            aria-selected={isAllActive}
            title="Show all"
            style={{
              flex: 1, borderRadius: "9px",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
              border: `1px solid ${isAllActive ? "rgba(95,227,255,0.5)" : "var(--line-2)"}`,
              background: isAllActive
                ? "linear-gradient(180deg, rgba(95,227,255,0.16), rgba(95,227,255,0.04))"
                : "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
              color: isAllActive ? "var(--cyan)" : "var(--ink-4)",
              cursor: "pointer",
              boxShadow: isAllActive ? "0 0 12px rgba(95,227,255,0.10)" : "none",
              transition: "all 0.12s ease",
              padding: "7px 4px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span style={{ fontFamily: "var(--mono)", fontSize: "7.5px", letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1 }}>All</span>
          </button>

          {CATEGORY_CONFIG.map(({ cat, label, color, glow, icon }) => {
            const isActive = activeCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                aria-selected={isActive}
                title={label}
                style={{
                  flex: 1, borderRadius: "9px",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
                  border: `1px solid ${isActive ? `color-mix(in srgb, ${color} 60%, transparent)` : "var(--line-2)"}`,
                  background: isActive
                    ? `linear-gradient(180deg, ${glow.replace("0.18", "0.08")}, rgba(255,255,255,0))`
                    : "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
                  color: isActive ? color : "var(--ink-4)",
                  cursor: "pointer",
                  boxShadow: isActive ? `0 0 12px ${glow}` : "none",
                  transition: "all 0.12s ease",
                  padding: "10px 4px",
                }}
              >
                {icon}
                <span style={{ fontFamily: "var(--mono)", fontSize: "7.5px", letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1, color: isActive ? color : "var(--ink-4)" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "10px 12px", flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", background: "rgba(8,12,18,0.7)", border: "1px solid var(--line-2)", borderRadius: "10px", padding: "0 12px 0 34px", height: "36px", transition: "border-color 0.15s, box-shadow 0.15s" }}>
            <svg style={{ position: "absolute", left: "11px", color: "var(--ink-4)", flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
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
              aria-label="Search for a city or place"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              role="combobox"
              style={{ appearance: "none", background: "transparent", border: 0, outline: 0, color: "var(--ink)", fontFamily: "var(--font)", fontSize: "13px", width: "100%" }}
            />
          </div>
          <button
            onClick={() => runSearch(search)}
            disabled={searchLoading || !search.trim()}
            aria-label="Search"
            style={{
              height: "44px", padding: "0 14px",
              background: "linear-gradient(180deg, rgba(95,227,255,0.18), rgba(95,227,255,0.06))",
              border: "1px solid rgba(95,227,255,0.35)",
              color: "var(--cyan)", fontFamily: "var(--mono)", fontWeight: 600, fontSize: "11px",
              letterSpacing: "0.06em", textTransform: "uppercase",
              borderRadius: "10px", cursor: "pointer",
              opacity: (searchLoading || !search.trim()) ? 0.4 : 1,
              transition: "opacity 0.15s ease",
              flexShrink: 0,
            }}
          >
            {searchLoading ? (
              <span className="animate-spin" style={{ display: "block", width: "14px", height: "14px", borderRadius: "50%", border: "2px solid var(--cyan)", borderTopColor: "transparent" }} />
            ) : "Go"}
          </button>
        </div>

        {/* History dropdown */}
        {isShowingHistory && (
          <div style={{ marginTop: "8px", background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "6px 12px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)" }}>Recent</span>
              <button onMouseDown={() => { clearHistory(); setSearchHistory([]); setShowDropdown(false); }} style={{ fontSize: "10px", color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", padding: "0 4px", minHeight: "44px" }}>Clear</button>
            </div>
            {searchHistory.map((item, i) => (
              <button key={i} onMouseDown={() => selectHistoryItem(item)} className="w-full text-left"
                style={{ padding: "0 12px", minHeight: "44px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "8px", background: focusedIdx === i ? "rgba(255,255,255,0.04)" : "transparent", cursor: "pointer" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>{item}</span>
              </button>
            ))}
          </div>
        )}

        {/* Geocode results dropdown — shows distance from current location */}
        {isShowingResults && (
          <div style={{ marginTop: "8px", background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: "10px", overflow: "hidden" }}>
            {searchResults.map((r, i) => {
              const dist = formatDist(r.distanceKm);
              return (
                <button key={i} onMouseDown={() => selectResult(r)} className="w-full text-left"
                  style={{ padding: "0 12px", minHeight: "44px", borderBottom: i < searchResults.length - 1 ? "1px solid var(--line)" : "none", display: "flex", alignItems: "center", gap: "10px", background: focusedIdx === i ? "rgba(255,255,255,0.04)" : "transparent", cursor: "pointer" }}
                  onMouseEnter={() => setFocusedIdx(i)} onMouseLeave={() => setFocusedIdx(-1)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="10" r="3"/><path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12Z"/>
                  </svg>
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    {r.region && <span style={{ fontSize: "11px", color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.region}</span>}
                  </span>
                  {dist && (
                    <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ink-4)", flexShrink: 0, letterSpacing: "0.02em" }}>{dist}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin: "0 12px 8px", padding: "10px 12px", background: "rgba(255,107,111,0.08)", border: "1px solid rgba(255,107,111,0.25)", borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <p style={{ fontSize: "12px", color: "var(--coral)", lineHeight: 1.5, flex: 1 }}>{error}</p>
          {onRetry && !error.includes("offline") && (
            <button onClick={onRetry} style={{ color: "var(--coral)", fontSize: "11px", fontWeight: 600, flexShrink: 0, textDecoration: "underline", textUnderlineOffset: "2px", background: "none", border: "none", cursor: "pointer" }}>Retry</button>
          )}
        </div>
      )}

      {/* City insights — fixed section (outside scroll, always visible while POIs scroll) */}
      {insightCityName && (insightsLoading || cityInsights) && (
        <div style={{ flexShrink: 0, margin: "0 10px 6px", borderRadius: "12px", border: "1px solid var(--line-2)", background: "linear-gradient(180deg, rgba(13,20,30,0.95), rgba(10,15,23,0.95))", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--coral)", boxShadow: "0 0 6px var(--coral)", flexShrink: 0, animation: "pulse 1.8s infinite" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--coral)", flexShrink: 0 }}>Exploring</span>
              <span style={{ width: "1px", height: "10px", background: "var(--line-2)", flexShrink: 0 }} />
              <span style={{ fontWeight: 500, fontSize: "13px", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {insightCityName}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              {!insightsLoading && slides.length > 0 && (
                <>
                  <button onClick={() => goTo((slide - 1 + slides.length) % slides.length)} aria-label="Previous slide"
                    style={{ minWidth: "44px", minHeight: "44px", borderRadius: "6px", display: "grid", placeItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line-2)", color: "var(--ink-3)", cursor: "pointer", fontSize: "14px" }}>‹</button>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--ink-4)", minWidth: "20px", textAlign: "center" }} aria-live="polite">{slide + 1}/{slides.length}</span>
                  <button onClick={() => goTo((slide + 1) % slides.length)} aria-label="Next slide"
                    style={{ minWidth: "44px", minHeight: "44px", borderRadius: "6px", display: "grid", placeItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line-2)", color: "var(--ink-3)", cursor: "pointer", fontSize: "14px" }}>›</button>
                </>
              )}
              <button onClick={() => setInsightsCollapsed((c) => !c)} aria-label={insightsCollapsed ? "Expand" : "Collapse"}
                style={{ minWidth: "44px", minHeight: "44px", borderRadius: "6px", display: "grid", placeItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line-2)", color: "var(--ink-3)", cursor: "pointer", fontSize: "12px" }}>
                {insightsCollapsed ? "▼" : "▲"}
              </button>
            </div>
          </div>

          {!insightsCollapsed && (
            <>
              <div style={{ padding: "12px 14px", minHeight: "90px" }}>
                {insightsLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <div className="skeleton" style={{ width: "16px", height: "16px", borderRadius: "5px" }} />
                      <div className="skeleton" style={{ width: "60px", height: "9px", borderRadius: "99px" }} />
                    </div>
                    <div className="skeleton" style={{ height: "9px", borderRadius: "99px", width: "100%" }} />
                    <div className="skeleton" style={{ height: "9px", borderRadius: "99px", width: "85%" }} />
                    <div className="skeleton" style={{ height: "9px", borderRadius: "99px", width: "65%" }} />
                  </div>
                ) : cityInsights && slides[slide] ? (() => {
                  const s = slides[slide];
                  const animClass = slideDir === "right" ? "animate-slide-in-right" : "animate-slide-in-left";
                  return (
                    <div key={`${slide}-${insightCityName}`} className={animClass}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
                        <span style={{ width: "20px", height: "20px", borderRadius: "5px", background: s.bg, border: `1px solid ${s.color}44`, display: "grid", placeItems: "center", color: s.color, fontSize: "11px" }}>
                          {s.key === "about" ? "📍" : s.key === "known" ? "✨" : s.key === "history" ? "🏛" : "💡"}
                        </span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: s.color, fontWeight: 600 }}>{s.label}</span>
                      </div>
                      {s.key === "about" && <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.55 }}>{cityInsights.overview}</p>}
                      {s.key === "known" && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {cityInsights.highlights.map((h, i) => (
                            <span key={i} style={{ padding: "4px 10px", borderRadius: "99px", fontSize: "11px", color: "var(--orchid)", background: "rgba(177,150,255,0.07)", border: "1px solid rgba(177,150,255,0.18)" }}>{h}</span>
                          ))}
                        </div>
                      )}
                      {s.key === "history" && <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.55 }}>{cityInsights.historicalFact}</p>}
                      {s.key === "tip" && <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.55 }}>{cityInsights.localTip}</p>}
                    </div>
                  );
                })() : null}
              </div>
              {!insightsLoading && slides.length > 0 && (
                <div style={{ display: "flex", gap: "5px", justifyContent: "flex-start", padding: "0 14px 10px" }}>
                  {slides.map((s, i) => (
                    <button key={s.key} onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "24px", minHeight: "44px", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                      <span style={{ display: "block", width: i === slide ? "18px" : "5px", height: "3px", borderRadius: "2px", background: i === slide ? slides[slide].color : "rgba(255,255,255,0.08)", transition: "all 0.25s ease", flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* POI section — dedicated scroll area for the virtual list */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ padding: "12px 10px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "4px", overscrollBehavior: "contain" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: "10px", padding: "8px", alignItems: "center" }}>
                <div className="skeleton" style={{ width: "34px", height: "34px", borderRadius: "9px" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div className="skeleton" style={{ height: "11px", borderRadius: "99px", width: "70%" }} />
                  <div className="skeleton" style={{ height: "9px", borderRadius: "99px", width: "50%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredPois.length === 0 && !error && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", gap: "8px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", marginBottom: "4px", display: "grid", placeItems: "center", fontSize: "22px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line-2)" }}>🗺️</div>
            <p style={{ color: "var(--ink-2)", fontSize: "13.5px", fontWeight: 600, letterSpacing: "-0.01em" }}>
              {search.trim() ? "No matches" : "No places found"}
            </p>
            <p style={{ color: "var(--ink-4)", fontSize: "12px", lineHeight: 1.5 }}>
              {search.trim() ? "Try a different keyword" : "Move the map or search a city to load places"}
            </p>
          </div>
        )}

        {/* POI list — virtualized */}
        {!loading && filteredPois.length > 0 && (
          <>
            <div style={{ padding: "10px 14px 6px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                Places nearby
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: "9.5px", color: "var(--ink)", letterSpacing: "0.06em" }}>{filteredPois.length}</span>
            </div>

            {/* Virtual scroll container */}
            <div ref={poiContainerRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 8px 18px", overscrollBehavior: "contain" }}>
              {/* Top spacer */}
              <div style={{ height: topPadding }} aria-hidden="true" />

              {filteredPois.slice(startIdx, endIdx).map((poi, localIdx) => {
                const globalIdx = startIdx + localIdx;
                const cfg = POI_COLORS[poi.category] ?? { color: "var(--cyan)", bg: "var(--cyan-dim)", border: "rgba(95,227,255,0.22)" };
                const fav = isFavorite(poi.id);
                return (
                  <div
                    key={poi.id}
                    className={globalIdx < 5 ? `group animate-fade-in stagger-${globalIdx + 1}` : "group"}
                    style={{
                      height: `${POI_ITEM_HEIGHT}px`,
                      display: "grid", gridTemplateColumns: "34px 1fr auto",
                      alignItems: "center", gap: "10px",
                      padding: "0 8px", borderRadius: "9px",
                      cursor: "pointer", border: "1px solid transparent",
                      boxSizing: "border-box",
                      transition: "background 0.12s ease, border-color 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--line-2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                    }}
                    onClick={() => onPoiClick(poi)}
                  >
                    <div style={{ width: "34px", height: "34px", borderRadius: "9px", display: "grid", placeItems: "center", background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, flexShrink: 0 }}>
                      {poi.category === "restaurant" ? "🍽️" : poi.category === "cafe" ? "☕" : poi.category === "attraction" ? "🎭" : poi.category === "park" ? "🌳" : "🏛️"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.005em" }}>{poi.name}</p>
                      <p style={{ fontSize: "11.5px", color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>{poi.address}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); fav ? removeFavorite(poi.id) : addFavorite(poi); }}
                        className={fav ? undefined : "sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"}
                        style={{ minWidth: "44px", minHeight: "44px", padding: "10px 8px", borderRadius: "6px", fontSize: "12px", color: fav ? "var(--coral)" : "var(--ink-4)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        title={fav ? "Remove from favorites" : "Add to favorites"}
                        aria-label={fav ? `Remove ${poi.name} from favorites` : `Add ${poi.name} to favorites`}
                        aria-pressed={fav}
                      >
                        {fav ? "♥" : "♡"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToPlanner(poi); }}
                        className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        style={{ minWidth: "44px", minHeight: "44px", padding: "10px 8px", borderRadius: "6px", fontSize: "13px", fontWeight: 700, color: "var(--ink-4)", background: "transparent", border: "none", cursor: "pointer", transition: "color 0.12s ease", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--cyan)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink-4)"; }}
                        title="Add to planner"
                        aria-label={`Add ${poi.name} to planner`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Bottom spacer — keeps scroll height correct for items below the window */}
              <div style={{ height: bottomPadding }} aria-hidden="true" />
            </div>
          </>
        )}
      </div>

      {/* Build / deploy timestamp */}
      {BUILD_LABEL && (
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--line)", padding: "5px 14px", textAlign: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--ink-5)", letterSpacing: "0.05em" }}>
            Updated {BUILD_LABEL}
          </span>
        </div>
      )}
    </div>
  );
}

const ExplorerSidebar = memo(ExplorerSidebarInner);
export default ExplorerSidebar;
