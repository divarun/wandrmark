"use client";
import React, { useState, useEffect } from "react";
import { useGamification } from "@/contexts/GamificationContext";
import { Achievement, Quest, Stamp, MysteryBox } from "@/types/gamification";
import { formatDistance, formatDuration } from "@/services/routing";
import { feedbackApi } from "@/services/api";
import { useFavorites } from "@/hooks/useFavorites";

type TabId = "stats" | "stamps" | "quests" | "badges" | "favorites";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "stats",
    label: "Stats",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    id: "stamps",
    label: "Stamps",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  },
  {
    id: "quests",
    label: "Quests",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    id: "badges",
    label: "Badges",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
  },
  {
    id: "favorites",
    label: "Saved",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  },
];

const LEVEL_AVATAR_COLORS: Record<string, string> = {
  Tourist:       "linear-gradient(135deg, rgba(177,150,255,0.25), rgba(95,227,255,0.15))",
  Traveler:      "linear-gradient(135deg, rgba(92,219,149,0.25), rgba(95,227,255,0.15))",
  Explorer:      "linear-gradient(135deg, rgba(95,227,255,0.25), rgba(177,150,255,0.15))",
  "Local Guide": "linear-gradient(135deg, rgba(177,150,255,0.30), rgba(255,143,183,0.15))",
  "City Expert": "linear-gradient(135deg, rgba(255,161,74,0.25), rgba(255,107,111,0.15))",
  Legend:        "linear-gradient(135deg, rgba(255,208,90,0.30), rgba(255,107,111,0.20))",
};

const LEVEL_INITIALS: Record<string, string> = {
  Tourist: "T", Traveler: "Tr", Explorer: "Ex",
  "Local Guide": "LG", "City Expert": "CE", Legend: "L",
};

const STAT_ROWS: { key: keyof ReturnType<typeof getStats>; label: string; unit?: string; color: string; bg: string; icon: React.ReactNode }[] = [
  {
    key: "stamps", label: "Stamps collected", color: "#ffa14a", bg: "rgba(255,161,74,0.10)",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  },
  {
    key: "pois", label: "POIs visited", color: "#ff6b6f", bg: "rgba(255,107,111,0.10)",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12Z"/></svg>,
  },
  {
    key: "favorites", label: "Saved places", color: "#ff8fb7", bg: "rgba(255,143,183,0.10)",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  },
  {
    key: "cities", label: "Cities explored", color: "#b196ff", bg: "rgba(177,150,255,0.10)",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><rect x="2" y="14" width="6" height="8"/><rect x="9" y="10" width="6" height="12"/><rect x="16" y="5" width="6" height="17"/></svg>,
  },
  {
    key: "quests", label: "Quests done", color: "#5cdb95", bg: "rgba(92,219,149,0.10)",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  {
    key: "streak", label: "Current streak", unit: "d", color: "#ff8a4a", bg: "rgba(255,138,74,0.10)",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  },
];

function getStats(statistics: { poisVisited: number; citiesVisited: number; questsCompleted: number; currentStreak: number }, stampsLen: number, favoritesLen: number) {
  return {
    stamps:    stampsLen,
    pois:      statistics.poisVisited,
    favorites: favoritesLen,
    cities:    statistics.citiesVisited,
    quests:    statistics.questsCompleted,
    streak:    statistics.currentStreak,
  };
}

const LEVEL_PROGRESSION = [
  { title: "Tourist",      xp: 0,    color: "#b196ff", emoji: "👤", levels: "Lv 1–4" },
  { title: "Traveler",     xp: 100,  color: "#5cdb95", emoji: "🎒", levels: "Lv 5–9" },
  { title: "Explorer",     xp: 300,  color: "#5fe3ff", emoji: "🧭", levels: "Lv 10–14" },
  { title: "Local Guide",  xp: 600,  color: "#b196ff", emoji: "🗺️", levels: "Lv 15–19" },
  { title: "City Expert",  xp: 1000, color: "#ffa14a", emoji: "⭐", levels: "Lv 20–24" },
  { title: "Legend",       xp: 2000, color: "#ffd05a", emoji: "👑", levels: "Lv 25+" },
];

export default function PassportPanel() {
  const { progress, tripHistory, openMysteryBox } = useGamification();
  const { favorites, removeFavorite } = useFavorites();
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const [showHelp, setShowHelp] = useState(false);
  const [openedBoxId, setOpenedBoxId] = useState<string | null>(null);

  // Star state
  const [starCount, setStarCount]   = useState(0);
  const [starred, setStarred]       = useState(false);
  const [starBusy, setStarBusy]     = useState(false);

  // Bug report state
  const [bugOpen, setBugOpen]           = useState(false);
  const [bugMessage, setBugMessage]     = useState("");
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugDone, setBugDone]           = useState(false);

  useEffect(() => {
    feedbackApi.getStarStatus().then(({ total, starred }) => {
      setStarCount(total);
      setStarred(starred);
    }).catch(() => {});
  }, []);

  async function handleStar() {
    if (starBusy) return;
    setStarBusy(true);
    try {
      const result = await feedbackApi.toggleStar();
      setStarCount(result.total);
      setStarred(result.starred);
    } catch {
      // silently ignore — Redis may be unavailable
    } finally {
      setStarBusy(false);
    }
  }

  async function handleBugSubmit() {
    if (bugSubmitting || bugMessage.trim().length < 10) return;
    setBugSubmitting(true);
    try {
      await feedbackApi.submitBug(bugMessage.trim());
      setBugDone(true);
      setBugMessage("");
      setTimeout(() => { setBugDone(false); setBugOpen(false); }, 2500);
    } catch {
      // keep form open so user can retry
    } finally {
      setBugSubmitting(false);
    }
  }

  if (!progress) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", fontSize: "22px" }}>📖</div>
        <p style={{ color: "var(--ink-4)", fontSize: "12px", textAlign: "center" }}>Your passport will appear as you explore</p>
      </div>
    );
  }

  const { passport, activeQuests, achievements } = progress;
  const { level, statistics, stamps } = passport;
  const xpPct = Math.min((level.xp / level.xpToNextLevel) * 100, 100);
  const stats = getStats(statistics, stamps.length, favorites.length);
  const avatarBg = LEVEL_AVATAR_COLORS[level.title] ?? LEVEL_AVATAR_COLORS.Tourist;
  const initials = LEVEL_INITIALS[level.title] ?? "E";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Profile card */}
      <div style={{ padding: "14px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        {/* Avatar + name row */}
        <div style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: "12px", alignItems: "start", marginBottom: "12px" }}>
          {/* Avatar with Lv chip */}
          <div style={{ position: "relative", width: "48px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "12px",
              background: avatarBg,
              border: "1px solid rgba(177,150,255,0.35)",
              display: "grid", placeItems: "center",
              color: "#fff", fontWeight: 600, fontSize: "16px",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px rgba(177,150,255,0.18)",
              fontFamily: "var(--mono)",
            }}>
              {initials}
            </div>
            <div style={{
              position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "-8px",
              background: "var(--bg-0)", border: "1px solid var(--line-3)",
              color: "var(--cyan)", fontFamily: "var(--mono)", fontWeight: 700, fontSize: "9px",
              padding: "2px 5px", borderRadius: "5px", whiteSpace: "nowrap",
            }}>
              Lv {level.level}
            </div>
          </div>

          {/* Title + XP subtitle */}
          <div style={{ paddingTop: "2px", minWidth: 0 }}>
            <p style={{ color: "var(--ink)", fontWeight: 600, fontSize: "15px", letterSpacing: "-0.01em" }}>{level.title}</p>
            <p style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", fontSize: "10px", letterSpacing: "0.03em", marginTop: "4px" }}>
              {level.xp} / {level.xpToNextLevel} XP · LVL {level.level}
            </p>
          </div>

          {/* Help button */}
          <button
            onClick={() => setShowHelp((v) => !v)}
            aria-label="How it works"
            aria-expanded={showHelp}
            style={{
              width: "28px", height: "28px", borderRadius: "8px", cursor: "pointer", flexShrink: 0,
              border: `1px solid ${showHelp ? "rgba(177,150,255,0.4)" : "var(--line-2)"}`,
              background: showHelp ? "rgba(177,150,255,0.08)" : "rgba(255,255,255,0.03)",
              color: showHelp ? "var(--orchid)" : "var(--ink-3)",
              display: "grid", placeItems: "center", fontWeight: 700, fontSize: "12px",
              transition: "all 0.12s ease",
            }}
          >
            ?
          </button>
        </div>

        {/* XP bar row */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.04em", color: "var(--ink-4)" }}>
            <span>{level.title}</span>
            <span>{level.xp}/{level.xpToNextLevel} XP</span>
          </div>
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
      </div>

      {/* Help panel — replaces tabs when open so it can scroll freely on mobile */}
      {showHelp ? (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {/* Sticky header */}
          <div style={{
            position: "sticky", top: 0, zIndex: 2,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px",
            background: "linear-gradient(180deg, rgba(10,15,23,0.98), rgba(10,15,23,0.92))",
            borderBottom: "1px solid rgba(177,150,255,0.14)",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--orchid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--orchid)", fontWeight: 600 }}>How it works</span>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              aria-label="Close help"
              style={{
                width: "26px", height: "26px", borderRadius: "7px", cursor: "pointer",
                border: "1px solid var(--line-2)", background: "rgba(255,255,255,0.03)",
                color: "var(--ink-3)", display: "grid", placeItems: "center",
                fontSize: "16px", lineHeight: 1, transition: "all 0.12s ease",
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "18px" }}>

            {/* Earning XP */}
            <div>
              <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)", marginBottom: "8px" }}>Earning XP</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {[
                  { label: "Visit a new place",        xp: "+10 XP", color: "#5fe3ff" },
                  { label: "Discover a new city",       xp: "+25 XP", color: "#b196ff" },
                  { label: "Complete a daily quest",    xp: "+50 XP", color: "#5cdb95" },
                  { label: "Earn a neighborhood stamp", xp: "+30 XP", color: "#ffa14a" },
                  { label: "Save a trip in Planner",    xp: "+15 XP", color: "#ff8fb7" },
                ].map(({ label, xp, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)" }}>
                    <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>{label}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: 600, color, flexShrink: 0, marginLeft: "8px" }}>{xp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Neighborhood stamps */}
            <div>
              <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)", marginBottom: "8px" }}>Neighborhood stamps</p>
              <p style={{ fontSize: "12px", color: "var(--ink-4)", lineHeight: 1.55, marginBottom: "10px" }}>
                Awarded when you visit enough unique places in a neighborhood. Rarity depends on where you explore.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {[
                  { emoji: "🎫", rarity: "Common",    desc: "Tourist hotspots in major cities",  color: "var(--ink-4)", bg: "rgba(255,255,255,0.02)", border: "var(--line)" },
                  { emoji: "✨", rarity: "Rare",      desc: "Lesser-known neighborhoods",         color: "#b196ff",       bg: "rgba(177,150,255,0.06)", border: "rgba(177,150,255,0.22)" },
                  { emoji: "🌟", rarity: "Legendary", desc: "Anywhere outside major cities",      color: "#ffd05a",       bg: "rgba(255,208,90,0.06)",  border: "rgba(255,208,90,0.22)" },
                ].map(({ emoji, rarity, desc, color, bg, border }) => (
                  <div key={rarity} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", background: bg, border: `1px solid ${border}` }}>
                    <span style={{ fontSize: "14px", flexShrink: 0 }}>{emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--mono)", fontSize: "9.5px", fontWeight: 600, color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{rarity}</p>
                      <p style={{ fontSize: "11.5px", color: "var(--ink-4)", marginTop: "2px" }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quests */}
            <div>
              <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)", marginBottom: "8px" }}>Quests</p>
              <div style={{ display: "flex", alignItems: "start", gap: "10px", padding: "10px 12px", borderRadius: "8px", background: "rgba(92,219,149,0.04)", border: "1px solid rgba(92,219,149,0.14)" }}>
                <span style={{ fontSize: "17px", flexShrink: 0, marginTop: "1px" }}>🎯</span>
                <p style={{ fontSize: "12px", color: "var(--ink-3)", lineHeight: 1.6 }}>
                  Two daily challenges unlock when you visit your first place: a discovery quest and a category quest. Both expire at midnight.
                </p>
              </div>
            </div>

            {/* Achievements */}
            <div>
              <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)", marginBottom: "8px" }}>Achievements</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {[
                  { emoji: "👣", name: "First Steps",    desc: "Visit 1 place",    xp: "+10" },
                  { emoji: "🗺️", name: "Explorer Fifty", desc: "Visit 50 places",  xp: "+200" },
                  { emoji: "💯", name: "Century Club",   desc: "Visit 100 places", xp: "+500" },
                ].map(({ emoji, name, desc, xp }) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)" }}>
                    <span style={{ fontSize: "15px", flexShrink: 0 }}>{emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "12px", color: "var(--ink-2)", fontWeight: 600 }}>{name}</p>
                      <p style={{ fontSize: "11px", color: "var(--ink-5)", marginTop: "1px", fontFamily: "var(--mono)" }}>{desc}</p>
                    </div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: 600, color: "#5cdb95", flexShrink: 0 }}>{xp} XP</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mystery Boxes */}
            <div>
              <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)", marginBottom: "8px" }}>Mystery Boxes</p>
              <div style={{ display: "flex", alignItems: "start", gap: "10px", padding: "10px 12px", borderRadius: "8px", background: "rgba(255,161,74,0.04)", border: "1px solid rgba(255,161,74,0.14)" }}>
                <span style={{ fontSize: "17px", flexShrink: 0, marginTop: "1px" }}>📦</span>
                <p style={{ fontSize: "12px", color: "var(--ink-3)", lineHeight: 1.6 }}>
                  Awarded every 10 visits. Open a box to reveal a local insight about the neighborhood you just explored.
                </p>
              </div>
            </div>

            {/* XP & Titles */}
            <div>
              <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)", marginBottom: "8px" }}>XP & Titles</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {LEVEL_PROGRESSION.map(({ title, xp, color, emoji, levels }) => {
                  const isCurrent = level.title === title;
                  return (
                    <div key={title} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "7px 10px", borderRadius: "8px",
                      background: isCurrent ? "rgba(177,150,255,0.08)" : "rgba(255,255,255,0.01)",
                      border: `1px solid ${isCurrent ? "rgba(177,150,255,0.25)" : "var(--line)"}`,
                    }}>
                      <span style={{ fontSize: "13px", flexShrink: 0 }}>{emoji}</span>
                      <span style={{ flex: 1, fontSize: "12px", color: isCurrent ? "var(--ink)" : "var(--ink-4)", fontWeight: isCurrent ? 600 : 400 }}>{title}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "9.5px", color: "var(--ink-5)" }}>{levels}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: isCurrent ? color : "var(--ink-5)", fontWeight: isCurrent ? 600 : 400, minWidth: "44px", textAlign: "right" }}>
                        {xp === 0 ? "Start" : `${xp} XP`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trip History */}
            <div style={{ paddingBottom: "4px" }}>
              <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)", marginBottom: "8px" }}>Trip History</p>
              <div style={{ display: "flex", alignItems: "start", gap: "10px", padding: "10px 12px", borderRadius: "8px", background: "rgba(95,227,255,0.04)", border: "1px solid rgba(95,227,255,0.14)" }}>
                <span style={{ fontSize: "17px", flexShrink: 0, marginTop: "1px" }}>🗓️</span>
                <p style={{ fontSize: "12px", color: "var(--ink-3)", lineHeight: 1.6 }}>
                  Every route you save in the Planner is recorded here with distance, duration, and a stop-by-stop breakdown.
                </p>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div
            role="tablist"
            style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "1px solid var(--line)", flexShrink: 0 }}
            aria-label="Passport sections"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    appearance: "none", border: 0, background: "transparent", cursor: "pointer",
                    padding: "11px 0",
                    fontFamily: "var(--font)", fontWeight: 500, fontSize: "11px",
                    color: isActive ? "var(--cyan)" : "var(--ink-3)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px",
                    borderBottom: `2px solid ${isActive ? "var(--cyan)" : "transparent"}`,
                    boxShadow: isActive ? "0 8px 12px -8px rgba(95,227,255,0.4)" : "none",
                    transition: "color 0.12s ease, border-color 0.12s ease",
                  }}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

        {/* Stats */}
        {activeTab === "stats" && (
          <div
            id="panel-stats"
            role="tabpanel"
            aria-labelledby="tab-stats"
            style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}
          >
            {stats.pois === 0 ? (
              /* ── First-run aspirational state ── */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: "8px", gap: "6px" }}>
                <div style={{
                  width: "52px", height: "52px", borderRadius: "16px", fontSize: "24px",
                  background: "linear-gradient(135deg, rgba(95,227,255,0.12), rgba(177,150,255,0.08))",
                  border: "1px solid rgba(95,227,255,0.22)",
                  display: "grid", placeItems: "center", marginBottom: "4px",
                }}>
                  🗺️
                </div>
                <p style={{ color: "var(--ink-2)", fontWeight: 600, fontSize: "14px" }}>Your passport is empty</p>
                <p style={{ color: "var(--ink-4)", fontSize: "12.5px", lineHeight: 1.55, maxWidth: "220px", marginBottom: "16px" }}>
                  Tap any place on the map to visit it and earn your first XP.
                </p>

                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)", textAlign: "left", marginBottom: "2px" }}>
                    First steps
                  </p>
                  {[
                    { icon: "📍", label: "Visit your first place", reward: "+10 XP", color: "var(--cyan)" },
                    { icon: "🎫", label: "Earn a neighborhood stamp", reward: "+30 XP", color: "#ffa14a" },
                    { icon: "🎯", label: "Complete a daily quest", reward: "+50 XP", color: "#5cdb95" },
                  ].map(({ icon, label, reward, color }) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "9px 12px", borderRadius: "9px", textAlign: "left",
                      background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)",
                    }}>
                      <span style={{ fontSize: "14px", flexShrink: 0 }}>{icon}</span>
                      <span style={{ flex: 1, fontSize: "12px", color: "var(--ink-3)" }}>{label}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "10.5px", fontWeight: 600, color, flexShrink: 0 }}>{reward}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Section header */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)" }}>Lifetime</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-5)" }}>
                    Since {new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                </div>

                {STAT_ROWS.map(({ key, label, unit, color, bg, icon }) => (
                  <div
                    key={key}
                    style={{
                      display: "grid", gridTemplateColumns: "28px 1fr auto",
                      alignItems: "center", gap: "12px",
                      padding: "11px 12px",
                      border: "1px solid var(--line-2)", borderRadius: "10px",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.012), rgba(255,255,255,0))",
                    }}
                  >
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", background: bg, border: `1px solid ${color}44`, color }}>
                      {icon}
                    </div>
                    <span style={{ color: "var(--ink-2)", fontSize: "12.5px", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "14px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                      {stats[key]}<span style={{ color: "var(--ink-4)", fontWeight: 500, fontSize: "11px", marginLeft: "2px" }}>{unit}</span>
                    </span>
                  </div>
                ))}

                {/* Mystery boxes */}
                {progress.mysteryBoxes.some(b => !b.opened) && (
                  <div style={{ marginTop: "8px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                    <p style={{ fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "10px" }}>
                      Mystery Boxes — {progress.mysteryBoxes.filter(b => !b.opened).length} unopened
                    </p>
                    {progress.mysteryBoxes.filter(b => !b.opened).map((box) => (
                      <MysteryBoxCard key={box.id} box={box} openedId={openedBoxId}
                        onOpen={(id) => { openMysteryBox(id); setOpenedBoxId(id); }} />
                    ))}
                  </div>
                )}

                {/* Trip history quick view */}
                {tripHistory.length > 0 && (
                  <div style={{ marginTop: "8px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                    <p style={{ fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "10px" }}>
                      Trip History — {tripHistory.length} recorded
                    </p>
                    {tripHistory.slice(-3).reverse().map((trip) => (
                      <div key={trip.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line-2)", background: "linear-gradient(180deg, rgba(255,255,255,0.012), transparent)", marginBottom: "6px" }}>
                        <div>
                          <p style={{ color: "var(--ink)", fontWeight: 500, fontSize: "12.5px" }}>{trip.cityName}</p>
                          <p style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", fontSize: "10px", marginTop: "2px" }}>
                            {formatDistance(trip.distance)} · {formatDuration(trip.duration)} · {trip.poisVisited.length} stops
                          </p>
                        </div>
                        <p style={{ color: "var(--ink-5)", fontFamily: "var(--mono)", fontSize: "9.5px", flexShrink: 0 }}>
                          {new Date(trip.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Stamps */}
        {activeTab === "stamps" && (
          <div
            id="panel-stamps"
            role="tabpanel"
            aria-labelledby="tab-stamps"
            style={{ padding: "14px" }}
          >
            {stamps.length === 0 ? (
              <EmptyState emoji="🎫" title="No stamps yet" subtitle="Visit neighborhoods to collect stamps" />
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)" }}>Collected</p>
                  <p style={{ color: "#ffd05a", fontFamily: "var(--mono)", fontSize: "10px", fontWeight: 600 }}>{stamps.length}</p>
                </div>
                {[...stamps]
                  .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
                  .map((stamp) => <StampCard key={stamp.id} stamp={stamp} />)}
              </>
            )}
          </div>
        )}

        {/* Quests */}
        {activeTab === "quests" && (
          <div
            id="panel-quests"
            role="tabpanel"
            aria-labelledby="tab-quests"
            style={{ padding: "14px" }}
          >
            {activeQuests.length === 0 ? (
              <EmptyState emoji="🎯" title="No active quests" subtitle="Visit a place to unlock today's quest" />
            ) : (
              <>
                <p style={{ fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "10px" }}>Active</p>
                {activeQuests.map((quest) => <QuestCard key={quest.id} quest={quest} />)}
              </>
            )}
            {progress.completedQuests.length > 0 && (
              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                <p style={{ fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "8px" }}>
                  Completed ({progress.completedQuests.length})
                </p>
                {progress.completedQuests.slice(-5).reverse().map((quest) => (
                  <div key={quest.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", background: "rgba(92,219,149,0.04)", border: "1px solid rgba(92,219,149,0.12)", marginBottom: "6px" }}>
                    <span style={{ color: "#5cdb95", fontSize: "12px", flexShrink: 0 }}>✓</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "var(--ink-3)", fontSize: "12px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quest.title}</p>
                      <p style={{ color: "var(--ink-5)", fontSize: "10px", fontFamily: "var(--mono)" }}>+{quest.reward.xp} XP</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Badges */}
        {activeTab === "badges" && (
          <div
            id="panel-badges"
            role="tabpanel"
            aria-labelledby="tab-badges"
            style={{ padding: "14px" }}
          >
            {achievements.length === 0 ? (
              <EmptyState emoji="🏆" title="No badges yet" subtitle="Start exploring to earn achievements" />
            ) : (
              <>
                <p style={{ fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "10px" }}>
                  Earned
                </p>
                {achievements.map((a) => <BadgeCard key={a.id} achievement={a} />)}
              </>
            )}
          </div>
        )}

        {/* Favorites */}
        {activeTab === "favorites" && (
          <div
            id="panel-favorites"
            role="tabpanel"
            aria-labelledby="tab-favorites"
            style={{ padding: "14px" }}
          >
            {favorites.length === 0 ? (
              <EmptyState emoji="♡" title="No saved places" subtitle="Tap the heart on any place to save it here" />
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)" }}>Saved</p>
                  <p style={{ color: "#ff8fb7", fontFamily: "var(--mono)", fontSize: "10px", fontWeight: 600 }}>{favorites.length}</p>
                </div>
                {[...favorites].sort((a, b) => b.savedAt - a.savedAt).map((poi) => {
                  const catColors: Record<string, { color: string; bg: string }> = {
                    restaurant: { color: "#ff6b6f", bg: "rgba(255,107,111,0.10)" },
                    cafe:       { color: "#ffa14a", bg: "rgba(255,161,74,0.10)"  },
                    attraction: { color: "#b196ff", bg: "rgba(177,150,255,0.10)" },
                    park:       { color: "#5cdb95", bg: "rgba(92,219,149,0.10)"  },
                    museum:     { color: "#ff8fb7", bg: "rgba(255,143,183,0.10)" },
                  };
                  const cfg = catColors[poi.category] ?? { color: "var(--cyan)", bg: "rgba(95,227,255,0.10)" };
                  const catEmoji: Record<string, string> = { restaurant: "🍽️", cafe: "☕", attraction: "🎭", park: "🌳", museum: "🏛️" };
                  return (
                    <div key={poi.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--line-2)", background: "linear-gradient(180deg, rgba(255,255,255,0.012), transparent)", marginBottom: "6px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", display: "grid", placeItems: "center", background: cfg.bg, border: `1px solid ${cfg.color}44`, fontSize: "14px", flexShrink: 0 }}>
                        {catEmoji[poi.category] ?? "📍"}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: "var(--ink)", fontWeight: 500, fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{poi.name}</p>
                        <p style={{ color: "var(--ink-4)", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>{poi.address}</p>
                      </div>
                      <button
                        onClick={() => removeFavorite(poi.id)}
                        aria-label={`Remove ${poi.name} from saved places`}
                        style={{ width: "28px", height: "28px", borderRadius: "7px", display: "grid", placeItems: "center", background: "rgba(255,107,111,0.08)", border: "1px solid rgba(255,107,111,0.22)", color: "var(--coral)", cursor: "pointer", fontSize: "12px", flexShrink: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
        </>
      )}

      {/* Footer — star + bug report */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--line)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>

        {/* Bug report form (inline, expands when open) */}
        {bugOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {bugDone ? (
              <p style={{ fontSize: "11.5px", color: "#5cdb95", textAlign: "center", padding: "6px 0", fontFamily: "var(--mono)" }}>
                Thanks — report received.
              </p>
            ) : (
              <>
                <textarea
                  autoFocus
                  value={bugMessage}
                  onChange={(e) => setBugMessage(e.target.value)}
                  placeholder="Describe the issue (min 10 chars)..."
                  rows={3}
                  style={{
                    width: "100%", resize: "none", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--line-2)",
                    borderRadius: "8px", padding: "8px 10px",
                    color: "var(--ink)", fontSize: "12px", fontFamily: "var(--font)",
                    lineHeight: 1.5, outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setBugOpen(false); setBugMessage(""); }}
                    style={{
                      appearance: "none", border: "1px solid var(--line-2)", borderRadius: "7px",
                      background: "transparent", color: "var(--ink-4)", cursor: "pointer",
                      fontSize: "11px", padding: "5px 12px", fontFamily: "var(--font)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBugSubmit}
                    disabled={bugSubmitting || bugMessage.trim().length < 10}
                    style={{
                      appearance: "none", border: "none", borderRadius: "7px",
                      background: bugSubmitting || bugMessage.trim().length < 10
                        ? "rgba(255,107,111,0.15)" : "rgba(255,107,111,0.22)",
                      color: bugSubmitting || bugMessage.trim().length < 10
                        ? "rgba(255,107,111,0.45)" : "var(--coral)",
                      cursor: bugSubmitting || bugMessage.trim().length < 10 ? "not-allowed" : "pointer",
                      fontSize: "11px", fontWeight: 600, padding: "5px 14px",
                      fontFamily: "var(--font)", transition: "all 0.12s ease",
                    }}
                  >
                    {bugSubmitting ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Star button */}
          <button
            onClick={handleStar}
            disabled={starBusy}
            aria-label={starred ? "Remove star" : "Star this app"}
            style={{
              appearance: "none",
              cursor: starBusy ? "default" : "pointer",
              display: "inline-flex", alignItems: "center", gap: "6px",
              color: starred ? "#ffd05a" : "rgba(255, 208, 90, 0.75)",
              fontSize: "12px", fontFamily: "var(--font)", fontWeight: 500,
              padding: "6px 11px", borderRadius: "8px",
              background: starred ? "rgba(255, 208, 90, 0.12)" : "rgba(255, 208, 90, 0.06)",
              border: starred ? "1px solid rgba(255, 208, 90, 0.4)" : "1px solid rgba(255, 208, 90, 0.2)",
              transition: "all 0.15s ease",
              flex: 1,
            }}
          >
            <svg
              width="13" height="13" viewBox="0 0 24 24"
              fill={starred ? "#ffd05a" : "none"}
              stroke={starred ? "#ffd05a" : "rgba(255, 208, 90, 0.75)"}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transition: "fill 0.15s ease, stroke 0.15s ease" }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {starCount > 0
              ? <span>{starCount} {starCount === 1 ? "star" : "stars"}</span>
              : <span>{starred ? "Starred" : "Star this app"}</span>
            }
          </button>

          {/* Bug report trigger */}
          <button
            onClick={() => { setBugOpen((v) => !v); setBugDone(false); }}
            style={{
              appearance: "none",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px",
              color: bugOpen ? "var(--coral)" : "rgba(255, 107, 111, 0.7)",
              fontSize: "12px", fontFamily: "var(--font)", fontWeight: 500,
              padding: "6px 11px", borderRadius: "8px",
              background: bugOpen ? "rgba(255, 107, 111, 0.1)" : "rgba(255, 107, 111, 0.05)",
              border: bugOpen ? "1px solid rgba(255, 107, 111, 0.35)" : "1px solid rgba(255, 107, 111, 0.2)",
              transition: "all 0.12s ease",
              flex: 1, justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Report a bug
          </button>
        </div>

      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "36px 16px", textAlign: "center", gap: "8px" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", fontSize: "22px", marginBottom: "4px" }}>
        {emoji}
      </div>
      <p style={{ color: "var(--ink-3)", fontSize: "13.5px", fontWeight: 600 }}>{title}</p>
      <p style={{ color: "var(--ink-5)", fontSize: "11.5px", lineHeight: 1.5 }}>{subtitle}</p>
    </div>
  );
}

function StampCard({ stamp }: { stamp: Stamp }) {
  const isLegendary = stamp.rarity === "legendary";
  const isRare = stamp.rarity === "rare";
  const accentColor = isLegendary ? "#ffd05a" : isRare ? "#b196ff" : "var(--ink-4)";
  const accentBg = isLegendary ? "rgba(255,208,90,0.04)" : isRare ? "rgba(177,150,255,0.04)" : "transparent";
  const accentBorder = isLegendary ? "rgba(255,208,90,0.28)" : isRare ? "rgba(177,150,255,0.25)" : "var(--line-2)";

  return (
    <div style={{ position: "relative", border: `1px solid ${accentBorder}`, borderRadius: "12px", background: accentBg, padding: "12px", overflow: "hidden", marginBottom: "10px" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: `linear-gradient(180deg, ${accentColor}, transparent)` }} />
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "7px", background: isLegendary ? "rgba(255,208,90,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${accentColor}44`, display: "grid", placeItems: "center", color: accentColor, fontSize: "12px", flexShrink: 0 }}>
            {isLegendary ? "🌟" : isRare ? "✨" : "🎫"}
          </div>
          <div>
            <p style={{ color: "var(--ink)", fontWeight: 600, fontSize: "13.5px" }}>{stamp.neighborhoodName}</p>
            <p style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", fontSize: "10px", letterSpacing: "0.02em", marginTop: "1px" }}>{stamp.cityName}</p>
          </div>
        </div>
        <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 7px", borderRadius: "5px", background: isLegendary ? "rgba(255,208,90,0.12)" : "rgba(255,255,255,0.04)", color: accentColor, border: `1px solid ${accentColor}44`, flexShrink: 0 }}>
          {stamp.rarity}
        </span>
      </div>
      {stamp.aiDescription && (
        <p style={{ color: "var(--ink-3)", fontSize: "12px", lineHeight: 1.5, marginBottom: "8px" }}>{stamp.aiDescription}</p>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: "9.5px", color: "var(--ink-5)", letterSpacing: "0.06em", borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
        <span>{stamp.uniquePOIsVisited} place{stamp.uniquePOIsVisited !== 1 ? "s" : ""}</span>
        <span>{new Date(stamp.earnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
    </div>
  );
}

function QuestCard({ quest }: { quest: Quest }) {
  const diffMap: Record<string, { color: string; bg: string; border: string }> = {
    easy:   { color: "#5cdb95", bg: "rgba(92,219,149,0.10)", border: "rgba(92,219,149,0.28)" },
    medium: { color: "#ffa14a", bg: "rgba(255,161,74,0.10)", border: "rgba(255,161,74,0.28)" },
    hard:   { color: "#ff6b6f", bg: "rgba(255,107,111,0.10)", border: "rgba(255,107,111,0.28)" },
    epic:   { color: "#b196ff", bg: "rgba(177,150,255,0.10)", border: "rgba(177,150,255,0.28)" },
  };
  const diff = diffMap[quest.difficulty] ?? diffMap.medium;

  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: "12px", padding: "12px", background: "linear-gradient(180deg, rgba(255,255,255,0.012), transparent)", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
        <p style={{ color: "var(--ink)", fontWeight: 600, fontSize: "13.5px" }}>{quest.title}</p>
        <span style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 7px", borderRadius: "5px", background: diff.bg, color: diff.color, border: `1px solid ${diff.border}`, flexShrink: 0 }}>
          {quest.difficulty}
        </span>
      </div>
      <p style={{ color: "var(--ink-3)", fontSize: "12px", lineHeight: 1.5, marginBottom: "10px" }}>{quest.description}</p>
      <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden", marginBottom: "6px" }}>
        <div style={{ height: "100%", width: `${quest.progress}%`, background: "linear-gradient(90deg, var(--cyan-2), #5cdb95)", borderRadius: "3px" }} />
      </div>
      {quest.requirements.map((req) => (
        <div key={req.id}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--ink-3)", letterSpacing: "0.04em" }}>{req.description}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--ink)" }}>{req.current}/{req.target}</span>
          </div>
          {req.type === "visit_categories" && req.current < req.target && req.details?.emoji && (
            <p style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ink-5)", letterSpacing: "0.03em", marginBottom: "3px" }}>
              {req.details.emoji} Tap any {req.details?.category} marker on the map
            </p>
          )}
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: "9.5px" }}>
        <span style={{ color: "var(--ink-5)" }}>
          {quest.expiresAt ? `Expires ${new Date(quest.expiresAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : "No expiry"}
        </span>
        <span style={{ color: "var(--cyan)", fontWeight: 600 }}>+{quest.reward.xp} XP</span>
      </div>
    </div>
  );
}

function MysteryBoxCard({ box, openedId, onOpen }: { box: MysteryBox; openedId: string | null; onOpen: (id: string) => void }) {
  const rarityConfig = {
    common:    { color: "var(--ink-3)", border: "var(--line-2)", bg: "rgba(255,255,255,0.02)", emoji: "📦", label: "Common" },
    rare:      { color: "#b196ff", border: "rgba(177,150,255,0.30)", bg: "rgba(177,150,255,0.06)", emoji: "✨", label: "Rare" },
    epic:      { color: "#ffa14a", border: "rgba(255,161,74,0.30)", bg: "rgba(255,161,74,0.06)", emoji: "🔮", label: "Epic" },
    legendary: { color: "#ffd05a", border: "rgba(255,208,90,0.35)", bg: "rgba(255,208,90,0.07)", emoji: "👑", label: "Legendary" },
  };
  const cfg = rarityConfig[box.rarity] ?? rarityConfig.common;
  const isRevealed = openedId === box.id;

  return (
    <div style={{ border: `1px solid ${cfg.border}`, borderRadius: "12px", background: cfg.bg, padding: "12px", marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "20px", flexShrink: 0 }}>{cfg.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: cfg.color, fontWeight: 600, marginBottom: "2px" }}>{cfg.label} box</p>
          {isRevealed ? (
            <p style={{ fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.5 }}>{box.reward.content}</p>
          ) : (
            <p style={{ fontSize: "11.5px", color: "var(--ink-4)" }}>Tap to reveal a local insight</p>
          )}
        </div>
        {!isRevealed && (
          <button
            onClick={() => onOpen(box.id)}
            style={{
              padding: "6px 12px", borderRadius: "8px", cursor: "pointer",
              background: `linear-gradient(180deg, ${cfg.bg.replace("0.06", "0.14")}, ${cfg.bg})`,
              border: `1px solid ${cfg.border}`,
              color: cfg.color, fontFamily: "var(--mono)", fontWeight: 600, fontSize: "10px",
              letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0,
              transition: "all 0.12s ease",
            }}
          >
            Open
          </button>
        )}
      </div>
    </div>
  );
}

function BadgeCard({ achievement }: { achievement: Achievement }) {
  const tierColors: Record<string, { color: string; bg: string; border: string }> = {
    bronze:   { color: "#c97c3a", bg: "rgba(201,124,58,0.08)", border: "rgba(201,124,58,0.25)" },
    silver:   { color: "#9aa5b4", bg: "rgba(154,165,180,0.06)", border: "rgba(154,165,180,0.20)" },
    gold:     { color: "#ffd05a", bg: "rgba(255,208,90,0.08)", border: "rgba(255,208,90,0.28)" },
    platinum: { color: "#5fe3ff", bg: "rgba(95,227,255,0.08)", border: "rgba(95,227,255,0.25)" },
  };
  const tier = tierColors[achievement.tier] ?? tierColors.silver;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: "12px", alignItems: "center", border: `1px solid ${tier.border}`, borderRadius: "12px", padding: "11px 12px", background: tier.bg, marginBottom: "8px" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: `1px solid ${tier.border}`, display: "grid", placeItems: "center", fontSize: "18px" }}>
        {achievement.iconEmoji}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: "var(--ink)", fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{achievement.name}</p>
        <p style={{ color: "var(--ink-4)", fontSize: "11.5px", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{achievement.description}</p>
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: 600, color: "#5cdb95", letterSpacing: "0.04em", flexShrink: 0 }}>
        +{achievement.reward.xp}
      </span>
    </div>
  );
}
