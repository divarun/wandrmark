"use client";

interface NavbarProps {
  mode: "explorer" | "planner";
  onModeChange: (mode: "explorer" | "planner") => void;
  rightDrawerOpen: boolean;
  onToggleRightDrawer: () => void;
  hasPassportBadge?: boolean;
}

export default function Navbar({
  mode,
  onModeChange,
  rightDrawerOpen,
  onToggleRightDrawer,
  hasPassportBadge = false,
}: NavbarProps) {
  const explorerActive = mode === "explorer";

  return (
    <header className="app-topbar">
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "30px", height: "30px", borderRadius: "8px",
            display: "grid", placeItems: "center",
            background: "linear-gradient(180deg, rgba(95,227,255,0.22), rgba(95,227,255,0.06))",
            border: "1px solid rgba(95,227,255,0.35)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px rgba(95,227,255,0.18)",
            color: "var(--cyan)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <span
          style={{
            fontWeight: 600, fontSize: "15px", color: "var(--cyan)",
            letterSpacing: "-0.01em", fontFamily: "var(--font)",
          }}
          className="hidden sm:block"
        >
          Wandrmark<span style={{ color: "var(--cyan-2)", textShadow: "0 0 12px var(--cyan-glow)" }}>.</span>
        </span>
      </div>

      {/* Mode segment */}
      <div
        role="tablist"
        style={{
          display: "inline-flex",
          background: "rgba(10,15,23,0.6)",
          border: "1px solid var(--line-2)",
          borderRadius: "10px",
          padding: "3px",
          gap: "2px",
        }}
      >
        <button
          role="tab"
          aria-selected={explorerActive}
          data-mode="explorer"
          title="Discover and visit nearby places"
          onClick={() => onModeChange("explorer")}
          style={{
            appearance: "none", border: 0, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: "7px",
            padding: "8px 14px", borderRadius: "7px",
            fontFamily: "var(--font)", fontWeight: 500, fontSize: "12.5px",
            letterSpacing: "-0.01em", transition: "all 0.12s ease",
            ...(explorerActive ? {
              color: "var(--cyan)",
              background: "linear-gradient(180deg, rgba(95,227,255,0.16), rgba(95,227,255,0.04))",
              boxShadow: "inset 0 0 0 1px rgba(95,227,255,0.35), 0 0 14px rgba(95,227,255,0.12)",
            } : {
              color: "var(--ink-3)",
              background: "transparent",
            }),
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="hidden sm:block">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Explorer
        </button>

        <button
          role="tab"
          aria-selected={!explorerActive}
          data-mode="planner"
          title="Build multi-stop routes and save itineraries"
          onClick={() => onModeChange("planner")}
          style={{
            appearance: "none", border: 0, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: "7px",
            padding: "8px 14px", borderRadius: "7px",
            fontFamily: "var(--font)", fontWeight: 500, fontSize: "12.5px",
            letterSpacing: "-0.01em", transition: "all 0.12s ease",
            ...(!explorerActive ? {
              color: "var(--orange)",
              background: "linear-gradient(180deg, rgba(255,161,74,0.18), rgba(255,161,74,0.04))",
              boxShadow: "inset 0 0 0 1px rgba(255,161,74,0.4), 0 0 14px rgba(255,161,74,0.10)",
            } : {
              color: "var(--ink-3)",
              background: "transparent",
            }),
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="hidden sm:block">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Planner
        </button>
      </div>

      {/* Right actions — passport button opens right rail drawer on tablet/mobile */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", alignItems: "center" }}>
        <button
          onClick={onToggleRightDrawer}
          aria-label={hasPassportBadge ? "Open passport — new updates" : "Open passport"}
          aria-controls="rightRail"
          aria-expanded={rightDrawerOpen}
          title="Passport"
          className="xl:hidden inline-flex items-center"
          style={{
            appearance: "none", cursor: "pointer",
            border: "1px solid",
            borderColor: rightDrawerOpen ? "rgba(95,227,255,0.35)" : hasPassportBadge ? "rgba(95,227,255,0.3)" : "var(--line-2)",
            background: rightDrawerOpen
              ? "linear-gradient(180deg, rgba(95,227,255,0.16), rgba(95,227,255,0.04))"
              : "rgba(10,15,23,0.6)",
            color: rightDrawerOpen ? "var(--cyan)" : "var(--ink-2)",
            padding: "8px 12px", borderRadius: "9px", minHeight: "44px",
            fontFamily: "var(--font)", fontWeight: 500, fontSize: "12.5px",
            gap: "7px",
            transition: "all 0.12s ease",
            position: "relative",
          }}
        >
          {hasPassportBadge && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute", top: "6px", right: "6px",
                width: "8px", height: "8px", borderRadius: "50%",
                background: "var(--cyan)",
                boxShadow: "0 0 6px rgba(95,227,255,0.7)",
                border: "1.5px solid rgba(10,15,23,0.9)",
                animation: "pulse 1.8s infinite",
              }}
            />
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 11h20"/><circle cx="7" cy="8" r="1" fill="currentColor"/><circle cx="11" cy="8" r="1" fill="currentColor"/>
          </svg>
          <span>Passport</span>
        </button>
      </div>
    </header>
  );
}
