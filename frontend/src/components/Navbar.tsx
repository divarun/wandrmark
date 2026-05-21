"use client";

interface NavbarProps {
  mode: "explorer" | "planner";
  onModeChange: (mode: "explorer" | "planner") => void;
  rightPanel: "passport" | "ai" | null;
  onToggleRightPanel: (panel: "passport" | "ai") => void;
}

export default function Navbar({ mode, onModeChange, rightPanel, onToggleRightPanel }: NavbarProps) {
  const explorerActive = mode === "explorer";
  const plannerActive  = mode === "planner";

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "linear-gradient(180deg, oklch(0.20 0.03 250 / 0.92), oklch(0.16 0.025 250 / 0.75))",
        borderBottom: "1px solid var(--line)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          height: "56px",
          padding: "0 20px",
          gap: "12px",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            style={{
              width: "34px", height: "34px", borderRadius: "10px",
              background: "linear-gradient(135deg, var(--cyan), oklch(0.65 0.12 235))",
              display: "grid", placeItems: "center", flexShrink: 0,
              boxShadow: "0 0 0 1px oklch(1 0 0 / 0.15) inset, 0 8px 20px -6px oklch(0.55 0.14 205 / 0.6)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.18 0.04 250)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s-7-7-7-13a7 7 0 1 1 14 0c0 6-7 13-7 13Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <span
            className="hidden sm:block"
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "17px", letterSpacing: "-0.02em", color: "var(--cyan)" }}
          >
            Wandrmark<span style={{ color: "var(--coral)" }}>.</span>
          </span>
        </div>

        {/* Centered tab pill */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            background: "oklch(0.22 0.03 250 / 0.6)",
            border: "1px solid var(--line)",
            borderRadius: "999px",
            padding: "4px",
          }}
        >
          <button
            onClick={() => onModeChange("explorer")}
            style={explorerActive ? {
              display: "inline-flex", alignItems: "center", gap: "7px",
              padding: "7px 16px", borderRadius: "999px",
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "13px",
              background: "linear-gradient(180deg, oklch(0.32 0.06 205), oklch(0.26 0.05 205))",
              color: "var(--cyan)",
              boxShadow: "0 0 0 1px oklch(0.55 0.12 205 / 0.6) inset, 0 6px 14px -6px oklch(0.55 0.12 205 / 0.5)",
              border: "none", cursor: "pointer", transition: "all 150ms ease",
            } : {
              display: "inline-flex", alignItems: "center", gap: "7px",
              padding: "7px 16px", borderRadius: "999px",
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "13px",
              color: "var(--ink-3)", border: "none",
              background: "transparent", cursor: "pointer", transition: "all 150ms ease",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/>
              <line x1="9" y1="3" x2="9" y2="18"/>
              <line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            <span className="hidden sm:inline">Explorer</span>
          </button>

          <button
            onClick={() => onModeChange("planner")}
            style={plannerActive ? {
              display: "inline-flex", alignItems: "center", gap: "7px",
              padding: "7px 16px", borderRadius: "999px",
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "13px",
              background: "linear-gradient(180deg, oklch(0.45 0.14 50), oklch(0.32 0.10 50))",
              color: "oklch(0.95 0.06 60)",
              boxShadow: "0 0 0 1px oklch(0.65 0.16 50 / 0.55) inset, 0 6px 14px -6px oklch(0.65 0.16 50 / 0.5)",
              border: "none", cursor: "pointer", transition: "all 150ms ease",
            } : {
              display: "inline-flex", alignItems: "center", gap: "7px",
              padding: "7px 16px", borderRadius: "999px",
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "13px",
              color: "var(--ink-3)", border: "none",
              background: "transparent", cursor: "pointer", transition: "all 150ms ease",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span className="hidden sm:inline">Planner</span>
          </button>
        </div>

        {/* Right actions */}
        <div className="hidden md:flex items-center gap-2 justify-end">
          <button
            onClick={() => onToggleRightPanel("passport")}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "8px 14px", borderRadius: "12px",
              background: rightPanel === "passport"
                ? "linear-gradient(180deg, oklch(0.32 0.06 205), oklch(0.24 0.05 205))"
                : "var(--panel)",
              border: rightPanel === "passport"
                ? "1px solid oklch(0.55 0.12 205 / 0.6)"
                : "1px solid var(--line)",
              color: rightPanel === "passport" ? "var(--cyan)" : "var(--ink-2)",
              fontWeight: 600, fontSize: "13px", cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <circle cx="12" cy="11" r="3"/>
              <path d="M9 17h6"/>
            </svg>
            <span className="hidden sm:inline">Passport</span>
          </button>

          {mode === "planner" && (
            <button
              onClick={() => onToggleRightPanel("ai")}
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "8px 14px", borderRadius: "12px",
                background: rightPanel === "ai"
                  ? "linear-gradient(180deg, oklch(0.36 0.10 295), oklch(0.26 0.08 295))"
                  : "var(--panel)",
                border: rightPanel === "ai"
                  ? "1px solid oklch(0.55 0.14 295 / 0.6)"
                  : "1px solid var(--line)",
                color: rightPanel === "ai" ? "var(--orchid)" : "var(--ink-2)",
                fontWeight: 700, fontSize: "13px", cursor: "pointer",
                letterSpacing: "0.02em",
                boxShadow: rightPanel === "ai" ? "0 8px 20px -10px oklch(0.55 0.14 295 / 0.5)" : "none",
                transition: "all 150ms ease",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0 14 9l9 2-9 2-2 9-2-9-9-2 9-2z"/>
              </svg>
              AI
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
