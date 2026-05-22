"use client";
import { POICategory } from "@/types";

interface CategoryFilterProps {
  active: POICategory[];
  onToggle: (category: POICategory) => void;
  onSelectAll?: () => void;
}

const ALL_CATEGORIES: POICategory[] = ["restaurant", "cafe", "attraction", "park", "museum"];

const CATEGORY_LABELS: Record<POICategory, string> = {
  restaurant: "Eat",
  cafe: "Café",
  attraction: "Visit",
  park: "Park",
  museum: "Arts",
};

const CATEGORY_ICONS: Record<POICategory, React.ReactNode> = {
  restaurant: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2"/>
      <path d="M5 11v11"/>
      <path d="M19 2v20"/>
      <path d="M19 12h-3a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3h3z"/>
    </svg>
  ),
  cafe: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
      <line x1="6" y1="2" x2="6" y2="4"/>
      <line x1="10" y1="2" x2="10" y2="4"/>
      <line x1="14" y1="2" x2="14" y2="4"/>
    </svg>
  ),
  attraction: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  ),
  park: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12"/>
      <path d="M5 12c0-4 3-7 7-7s7 3 7 7c0 2-1.5 4-3 4H8c-1.5 0-3-2-3-4Z"/>
    </svg>
  ),
  museum: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22"/>
      <line x1="6" y1="18" x2="6" y2="11"/>
      <line x1="10" y1="18" x2="10" y2="11"/>
      <line x1="14" y1="18" x2="14" y2="11"/>
      <line x1="18" y1="18" x2="18" y2="11"/>
      <polygon points="12 2 20 7 4 7"/>
    </svg>
  ),
};

const ACTIVE_STYLES: Record<POICategory, { background: string; border: string; color: string }> = {
  restaurant: {
    background: "linear-gradient(180deg, oklch(0.32 0.10 22 / 0.8), oklch(0.24 0.08 22 / 0.8))",
    border: "1px solid oklch(0.6 0.14 22)",
    color: "var(--coral)",
  },
  cafe: {
    background: "linear-gradient(180deg, oklch(0.32 0.10 70 / 0.8), oklch(0.24 0.08 70 / 0.8))",
    border: "1px solid oklch(0.6 0.14 70)",
    color: "var(--amber)",
  },
  attraction: {
    background: "linear-gradient(180deg, oklch(0.32 0.10 295 / 0.8), oklch(0.24 0.08 295 / 0.8))",
    border: "1px solid oklch(0.6 0.14 295)",
    color: "var(--orchid)",
  },
  park: {
    background: "linear-gradient(180deg, oklch(0.32 0.10 160 / 0.8), oklch(0.24 0.08 160 / 0.8))",
    border: "1px solid oklch(0.6 0.14 160)",
    color: "var(--mint)",
  },
  museum: {
    background: "linear-gradient(180deg, oklch(0.32 0.08 205 / 0.8), oklch(0.24 0.06 205 / 0.8))",
    border: "1px solid oklch(0.55 0.12 205 / 0.8)",
    color: "var(--cyan)",
  },
};

const BTN_BASE: React.CSSProperties = {
  height: "50px",
  padding: "0 10px",
  minWidth: "46px",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "3px",
  cursor: "pointer",
  transition: "all 150ms ease",
  flexShrink: 0,
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "8.5px",
  letterSpacing: "0.04em",
  fontWeight: 500,
  lineHeight: 1,
};

export default function CategoryFilter({ active, onToggle, onSelectAll }: CategoryFilterProps) {
  const isAllActive = active.length === ALL_CATEGORIES.length;

  return (
    <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {/* All button */}
      <button
        onClick={onSelectAll}
        title="Show all categories"
        style={{
          ...BTN_BASE,
          background: isAllActive
            ? "linear-gradient(180deg, oklch(0.32 0.08 205 / 0.8), oklch(0.24 0.06 205 / 0.8))"
            : "var(--panel)",
          border: isAllActive ? "1px solid oklch(0.55 0.12 205 / 0.8)" : "1px solid var(--line)",
          color: isAllActive ? "var(--cyan)" : "var(--ink-3)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span style={{ ...LABEL_STYLE, color: "inherit" }}>All</span>
      </button>

      {ALL_CATEGORIES.map((cat) => {
        const isActive = active.includes(cat);
        const activeStyle = ACTIVE_STYLES[cat];
        return (
          <button
            key={cat}
            onClick={() => onToggle(cat)}
            title={cat.charAt(0).toUpperCase() + cat.slice(1)}
            style={isActive ? {
              ...BTN_BASE,
              background: activeStyle.background,
              border: activeStyle.border,
              color: activeStyle.color,
              transform: "translateY(-1px)",
            } : {
              ...BTN_BASE,
              background: "var(--panel)",
              border: "1px solid var(--line)",
              color: "var(--ink-3)",
            }}
          >
            {CATEGORY_ICONS[cat]}
            <span style={{ ...LABEL_STYLE, color: "inherit" }}>{CATEGORY_LABELS[cat]}</span>
          </button>
        );
      })}
    </div>
  );
}
