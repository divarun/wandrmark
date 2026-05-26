"use client";
import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "wandrmark:onboarding_done";

export function isOnboardingDone(): boolean {
  try {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

function markDone() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {}
}

const STEPS = [
  {
    icon: "🌍",
    title: "Welcome to Wandrmark",
    body: "Discover places worth visiting, earn your Explorer Passport, and plan trips — no account needed.",
  },
  {
    icon: "🗺️",
    title: "Find places around you",
    body: "Search any city or use your location. Browse restaurants, cafes, attractions, parks, and museums on the map.",
  },
  {
    icon: "🎖️",
    title: "Build your Explorer Passport",
    body: "Visit places to earn XP and stamps. Complete quests, unlock badges, and level up from Tourist to Legend.",
  },
  {
    icon: "🗓️",
    title: "Plan multi-stop routes",
    body: "Switch to Planner mode to build itineraries, get turn-by-turn directions, and save your trips.",
  },
];

export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  const dismiss = () => {
    markDone();
    onClose();
  };

  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") dismissRef.current(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const advance = () => (step < STEPS.length - 1 ? setStep((s) => s + 1) : dismiss());

  const { icon, title, body } = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(5,8,12,0.8)", backdropFilter: "blur(4px)" }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Wandrmark"
    >
      <div
        className="glass-card animate-scale-in mx-4 w-full text-center"
        style={{ maxWidth: "360px", padding: "32px 28px 28px", position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Skip */}
        {!isLast && (
          <button
            onClick={dismiss}
            style={{
              position: "absolute", top: "14px", right: "14px",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--ink-4)", fontSize: "12px", fontFamily: "var(--font)",
              padding: "4px 8px", borderRadius: "6px",
              transition: "color 0.12s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-4)")}
          >
            Skip
          </button>
        )}

        {/* Step content — keyed so it fades in on each step */}
        <div key={step} className="animate-fade-in">
          <div style={{ fontSize: "52px", lineHeight: 1, marginBottom: "20px" }}>{icon}</div>
          <h2
            className="text-gradient font-display"
            style={{ fontSize: "20px", fontWeight: 700, marginBottom: "10px" }}
          >
            {title}
          </h2>
          <p style={{ color: "var(--ink-3)", fontSize: "14px", lineHeight: "1.65", marginBottom: "0" }}>
            {body}
          </p>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: "6px", margin: "24px 0 20px" }}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                height: "6px",
                width: i === step ? "20px" : "6px",
                borderRadius: "99px",
                background: i === step ? "var(--cyan)" : "var(--line-3)",
                transition: "all 0.25s ease",
                display: "block",
              }}
            />
          ))}
        </div>

        <button className="btn-primary w-full" onClick={advance}>
          {isLast ? "Start exploring" : "Next"}
        </button>
      </div>
    </div>
  );
}
