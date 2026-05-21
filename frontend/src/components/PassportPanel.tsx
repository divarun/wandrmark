"use client";
import React, { useState } from "react";
import { useGamification } from "@/contexts/GamificationContext";
import { Achievement, Quest, MysteryBox, Stamp, TripMemory } from "@/types/gamification";
import { formatDistance, formatDuration } from "@/services/routing";

export default function PassportPanel() {
  const { progress, visitedPoiIds, openMysteryBox, tripHistory } = useGamification();
  const [activeTab, setActiveTab] = useState<"overview" | "stamps" | "quests" | "achievements" | "mystery" | "history">("overview");
  const [showGuide, setShowGuide] = useState(false);

  if (!progress) return (
    <div className="flex flex-col h-full items-center justify-center gap-3 p-6">
      <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-xl">📖</div>
      <p className="text-slate-500 text-sm text-center">Your passport will appear here as you explore</p>
    </div>
  );

  const { passport, activeQuests, achievements, mysteryBoxes } = progress;
  const { level, statistics, badges, stamps } = passport;
  const xpPct = Math.min((level.xp / level.xpToNextLevel) * 100, 100);

  const TABS = [
    { id: "overview",      label: "Stats",   emoji: "📊" },
    { id: "stamps",        label: "Stamps",  emoji: "🎫" },
    { id: "quests",        label: "Quests",  emoji: "🎯" },
    { id: "achievements",  label: "Badges",  emoji: "🏆" },
    { id: "mystery",       label: "Boxes",   emoji: "🎁" },
    { id: "history",       label: "History", emoji: "📅" },
  ] as const;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Traveler header — compact */}
      <div
        className="flex-shrink-0"
        style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: getLevelGradientCSS(level.title),
              display: "grid", placeItems: "center",
              boxShadow: "0 0 0 1px oklch(1 0 0 / 0.15) inset",
              fontSize: "20px",
            }}>
              {getLevelEmoji(level.title)}
            </div>
            <div style={{
              position: "absolute", bottom: "-3px", right: "-3px",
              width: "18px", height: "18px", borderRadius: "50%",
              background: "linear-gradient(135deg, var(--coral), oklch(0.55 0.14 22))",
              display: "grid", placeItems: "center",
              color: "white", fontWeight: 800, fontSize: "9px",
              border: "2px solid var(--bg-2)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              {level.level}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "15px", letterSpacing: "-0.01em", color: "var(--ink)" }}>
                {level.title}
              </p>
              <span style={{ fontSize: "11px", color: "var(--mint)", fontWeight: 600 }}>Lv {level.level}</span>
            </div>
            <div className="xp-bar" style={{ marginTop: "5px" }}>
              <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
            </div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: "var(--ink-4)", marginTop: "3px" }}>
              {level.xp} / {level.xpToNextLevel} XP
            </p>
          </div>

          <button
            onClick={() => setShowGuide(g => !g)}
            title="How it works"
            style={{
              width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
              background: showGuide ? "oklch(0.32 0.06 205 / 0.3)" : "var(--panel)",
              border: showGuide ? "1px solid oklch(0.55 0.12 205 / 0.5)" : "1px solid var(--line)",
              color: showGuide ? "var(--cyan)" : "var(--ink-3)",
              display: "grid", placeItems: "center", cursor: "pointer",
              fontSize: "12px", fontWeight: 700,
            }}
          >
            ?
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--line)", padding: "0 8px" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flexShrink: 0,
              display: "inline-flex", alignItems: "center", gap: "4px",
              padding: "9px 8px",
              fontSize: "11.5px", fontWeight: 600,
              color: activeTab === tab.id ? "var(--cyan)" : "var(--ink-3)",
              background: "transparent", border: "none", cursor: "pointer",
              position: "relative", whiteSpace: "nowrap",
              transition: "color 150ms ease",
            }}
          >
            {activeTab === tab.id && (
              <span style={{
                position: "absolute", left: "6px", right: "6px", bottom: "-1px",
                height: "2px", background: "var(--cyan)", borderRadius: "2px",
                boxShadow: "0 0 8px var(--cyan)",
              }} />
            )}
            <span style={{ fontSize: "12px" }}>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {showGuide ? <GuideTab /> : (
          <>
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <StatRow emoji="🎫" label="Stamps" value={stamps.length} color="amber" onClick={() => setActiveTab("stamps")} />
                <StatRow emoji="📍" label="POIs visited" value={statistics.poisVisited} color="coral" />
                <StatRow emoji="🌆" label="Cities explored" value={statistics.citiesVisited} color="orchid" />
                <StatRow emoji="🚶" label="Distance" value={`${(statistics.totalDistance / 1000).toFixed(1)} km`} color="ocean" />
                <StatRow emoji="✅" label="Quests done" value={statistics.questsCompleted} color="emerald" />
                <StatRow emoji="🔥" label="Streak" value={`${statistics.currentStreak}d`} color="fire" />
                {badges.length > 0 && (
                  <div style={{ paddingTop: "10px", marginTop: "4px", borderTop: "1px solid var(--line)" }}>
                    <p className="section-label" style={{ marginBottom: "8px" }}>Recent Badges</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {badges.slice(0, 8).map((badge) => (
                        <div
                          key={badge.id}
                          style={{
                            width: "38px", height: "38px", borderRadius: "10px",
                            background: "linear-gradient(180deg, var(--panel-2), var(--panel))",
                            border: "1px solid var(--line)",
                            display: "grid", placeItems: "center", fontSize: "16px",
                          }}
                          title={badge.description}
                        >
                          {badge.iconEmoji}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "stamps" && (
              <div className="space-y-2">
                {stamps.length === 0 ? (
                  <EmptyState emoji="🎫" title="No stamps yet" subtitle="Visit neighborhoods to collect stamps" />
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <p className="section-label">{stamps.length} collected</p>
                      <div className="flex gap-1.5">
                        {getRarityDistribution(stamps).map(({ rarity, count }) => (
                          <span key={rarity} className="text-[10px] text-slate-500" title={`${count} ${rarity}`}>
                            {getRarityEmoji(rarity)}{count}
                          </span>
                        ))}
                      </div>
                    </div>
                    {[...stamps]
                      .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
                      .map((stamp) => <StampCard key={stamp.id} stamp={stamp} />)}
                  </>
                )}
              </div>
            )}

            {activeTab === "quests" && (
              <div className="space-y-2">
                {activeQuests.length === 0 ? (
                  <EmptyState emoji="🎯" title="No active quests" subtitle="Visit a place to unlock today's quest" />
                ) : (
                  <>
                    <p className="section-label mb-1">Active</p>
                    {activeQuests.map((quest) => <QuestCard key={quest.id} quest={quest} />)}
                  </>
                )}
                {progress.completedQuests.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="section-label mb-2">Completed ({progress.completedQuests.length})</p>
                    {progress.completedQuests.slice(-5).reverse().map((quest) => (
                      <div key={quest.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-1.5">
                        <span className="text-emerald-400 text-sm">✓</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-400 text-xs font-semibold truncate">{quest.title}</p>
                          <p className="text-slate-600 text-[10px]">+{quest.reward.xp} XP</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "achievements" && (
              <div className="space-y-2">
                {achievements.length === 0 ? (
                  <EmptyState emoji="🏆" title="No achievements yet" subtitle="Start exploring to earn badges" />
                ) : (
                  achievements.map((a) => <AchievementCard key={a.id} achievement={a} />)
                )}
              </div>
            )}

            {activeTab === "mystery" && (
              <div className="space-y-2">
                {mysteryBoxes.length === 0 ? (
                  <EmptyState emoji="🎁" title="No mystery boxes" subtitle="Visit 10 places to earn one" />
                ) : (
                  mysteryBoxes.map((box) => (
                    <MysteryBoxCard key={box.id} box={box} onOpen={openMysteryBox} />
                  ))
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-2">
                {tripHistory.length === 0 ? (
                  <EmptyState emoji="📅" title="No trips yet" subtitle="Save a planned route to record it here" />
                ) : (
                  <>
                    <p className="section-label mb-1">{tripHistory.length} trip{tripHistory.length !== 1 ? "s" : ""} recorded</p>
                    {tripHistory.map((trip) => <TripCard key={trip.id} trip={trip} />)}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

const STAT_COLOR_MAP: Record<string, { bg: string; border: string; color: string }> = {
  ocean:   { bg: "oklch(0.30 0.10 205 / 0.5)", border: "oklch(0.5 0.12 205 / 0.5)", color: "var(--cyan)" },
  coral:   { bg: "oklch(0.30 0.10 22 / 0.5)",  border: "oklch(0.5 0.14 22 / 0.5)",  color: "var(--coral)" },
  emerald: { bg: "oklch(0.30 0.10 160 / 0.5)", border: "oklch(0.5 0.12 160 / 0.5)", color: "var(--mint)" },
  amber:   { bg: "oklch(0.30 0.10 70 / 0.5)",  border: "oklch(0.5 0.12 70 / 0.5)",  color: "var(--amber)" },
  orchid:  { bg: "oklch(0.30 0.10 295 / 0.5)", border: "oklch(0.5 0.14 295 / 0.5)", color: "var(--orchid)" },
  fire:    { bg: "oklch(0.30 0.10 40 / 0.5)",  border: "oklch(0.5 0.14 40 / 0.5)",  color: "oklch(0.78 0.18 40)" },
};

function StatRow({
  emoji, label, value, color, onClick,
}: {
  emoji: string;
  label: string;
  value: string | number;
  color: "ocean" | "coral" | "emerald" | "amber" | "orchid" | "fire";
  onClick?: () => void;
}) {
  const cs = STAT_COLOR_MAP[color] ?? STAT_COLOR_MAP.ocean;
  const Tag = (onClick ? "button" : "div") as React.ElementType;

  return (
    <Tag
      onClick={onClick}
      style={{
        display: "grid", gridTemplateColumns: "30px 1fr auto",
        alignItems: "center", gap: "10px",
        padding: "8px 12px",
        background: "linear-gradient(180deg, var(--panel-2), var(--panel))",
        border: "1px solid var(--line)",
        borderRadius: "10px",
        width: "100%", textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 120ms ease",
      }}
    >
      <div style={{
        width: "30px", height: "30px", borderRadius: "8px",
        background: cs.bg, border: `1px solid ${cs.border}`,
        display: "grid", placeItems: "center",
        fontSize: "14px",
      }}>
        {emoji}
      </div>
      <span style={{ fontSize: "12.5px", color: "var(--ink-2)", fontWeight: 500 }}>{label}</span>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em",
        color: cs.color,
      }}>
        {value}
      </span>
    </Tag>
  );
}

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl mb-3">
        {emoji}
      </div>
      <p className="text-slate-400 text-sm font-semibold mb-1">{title}</p>
      <p className="text-slate-600 text-xs">{subtitle}</p>
    </div>
  );
}

function StampCard({ stamp }: { stamp: Stamp }) {
  const rarityStyle = {
    common:    "border-slate-600/40 bg-slate-800/40",
    rare:      "border-ocean-500/40 bg-ocean-900/30",
    legendary: "border-amber-500/50 bg-amber-900/20",
  }[stamp.rarity];

  const rarityText = {
    common:    "text-slate-400",
    rare:      "text-ocean-300",
    legendary: "text-amber-300",
  }[stamp.rarity];

  return (
    <div className={`border rounded-xl p-3 ${rarityStyle}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{getRarityEmoji(stamp.rarity)}</span>
          <div>
            <p className="text-white font-semibold text-sm">{stamp.neighborhoodName}</p>
            <p className="text-slate-400 text-xs">{stamp.cityName}, {stamp.countryCode}</p>
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase ${rarityText}`}>{stamp.rarity}</span>
      </div>

      {stamp.aiDescription && (
        <p className="text-slate-400 text-xs leading-relaxed bg-black/[0.2] rounded-lg p-2 mb-2">
          {stamp.aiDescription}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-white/[0.08] pt-2">
        <span>{stamp.uniquePOIsVisited} place{stamp.uniquePOIsVisited !== 1 ? "s" : ""}</span>
        <span>{new Date(stamp.earnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
    </div>
  );
}

function QuestCard({ quest }: { quest: Quest }) {
  const diffColor = {
    easy:   "text-emerald-400",
    medium: "text-amber-400",
    hard:   "text-coral-400",
    epic:   "text-purple-400",
  }[quest.difficulty];

  return (
    <div className="glass-card p-3">
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <p className="text-white font-semibold text-sm">{quest.title}</p>
          <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{quest.description}</p>
        </div>
        <span className={`text-[10px] font-bold flex-shrink-0 ${diffColor}`}>{quest.difficulty.toUpperCase()}</span>
      </div>
      <div className="xp-bar mb-2">
        <div className="xp-bar-fill" style={{ width: `${quest.progress}%` }} />
      </div>
      <div className="space-y-1">
        {quest.requirements.map((req) => (
          <div key={req.id} className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{req.description}</span>
            <span className="text-slate-300 font-semibold">{req.current}/{req.target}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-slate-600 text-[11px]">
          {quest.expiresAt
            ? `Expires ${new Date(quest.expiresAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
            : "Reward"}
        </span>
        <span className="text-ocean-300 text-[11px] font-semibold">+{quest.reward.xp} XP</span>
      </div>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const tierStyle = {
    bronze:   "border-amber-700/40 bg-amber-900/20",
    silver:   "border-slate-400/30 bg-slate-800/30",
    gold:     "border-amber-400/40 bg-amber-900/20",
    platinum: "border-ocean-400/40 bg-ocean-900/20",
  }[achievement.tier];

  return (
    <div className={`border rounded-xl px-3 py-2.5 flex items-center gap-3 ${tierStyle}`}>
      <span className="text-xl flex-shrink-0">{achievement.iconEmoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{achievement.name}</p>
        <p className="text-slate-400 text-xs">{achievement.description}</p>
      </div>
      <span className="text-ocean-300 text-xs font-semibold flex-shrink-0">+{achievement.reward.xp} XP</span>
    </div>
  );
}

function MysteryBoxCard({ box, onOpen }: { box: MysteryBox; onOpen: (id: string) => void }) {
  const rarityStyle = {
    common:    "border-slate-600/40 bg-slate-800/30",
    rare:      "border-ocean-500/40 bg-ocean-900/20",
    epic:      "border-purple-500/40 bg-purple-900/20",
    legendary: "border-amber-400/40 bg-amber-900/15",
  }[box.rarity];

  return (
    <div className={`border rounded-xl p-3 ${rarityStyle}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">🎁</span>
        <span className="text-[10px] font-bold text-white uppercase tracking-wide">{box.rarity}</span>
      </div>
      {!box.opened ? (
        <button onClick={() => onOpen(box.id)} className="w-full btn-primary py-2 text-sm">
          Open Mystery Box
        </button>
      ) : (
        <div className="bg-black/[0.2] rounded-lg p-2.5">
          <p className="text-slate-300 text-xs leading-relaxed">{box.reward.content}</p>
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: TripMemory }) {
  const [expanded, setExpanded] = useState(false);

  const moodEmojis: Record<string, string> = {
    contemplative: "🤔", energetic: "⚡", creative: "🎨", indulgent: "🍰",
    peaceful: "🌿", social: "👥", intellectual: "📚", adventurous: "🏔️",
  };

  return (
    <div className="glass-card p-3">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm">🗺️</span>
              <p className="text-white font-semibold text-sm truncate">{trip.cityName}</p>
              {trip.mood && (
                <span className="text-sm flex-shrink-0" title={trip.mood}>{moodEmojis[trip.mood]}</span>
              )}
            </div>
            <p className="text-slate-500 text-[10px]">
              {new Date(trip.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <span className="text-slate-600 text-xs flex-shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>
        <div className="flex gap-3 mt-2">
          <span className="text-ocean-400 text-[11px] font-semibold">{formatDistance(trip.distance)}</span>
          <span className="text-slate-600 text-[11px]">·</span>
          <span className="text-slate-400 text-[11px]">{formatDuration(trip.duration)}</span>
          <span className="text-slate-600 text-[11px]">·</span>
          <span className="text-slate-400 text-[11px]">{trip.poisVisited.length} stop{trip.poisVisited.length !== 1 ? "s" : ""}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
          {trip.poisVisited.map((poi, i) => (
            <div key={poi.id ?? i} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-ocean-500/[0.3] border border-ocean-500/[0.4] text-ocean-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <p className="text-slate-400 text-[11px] truncate">{poi.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuideTab() {
  return (
    <div className="space-y-4 pb-2">
      <GuideSection emoji="🎫" title="Stamps">
        <p className="text-slate-400 text-xs leading-relaxed mb-2">
          Earned each time you visit a new place. Each stamp records the neighborhood and city. Rarity is determined by how off-the-beaten-path the area is.
        </p>
        <div className="space-y-1">
          <RarityRow emoji="🎫" label="Common" desc="Tourist hotspots in major cities" color="text-slate-400" />
          <RarityRow emoji="✨" label="Rare" desc="Lesser-known neighborhoods" color="text-ocean-300" />
          <RarityRow emoji="🌟" label="Legendary" desc="Anywhere outside major cities" color="text-amber-300" />
        </div>
      </GuideSection>

      <GuideSection emoji="✨" title="XP & Titles">
        <p className="text-slate-400 text-xs leading-relaxed mb-2">
          Every new place you visit earns +10 XP. Completing quests and unlocking achievements gives bonus XP. Your title advances every 5 levels.
        </p>
        <div className="space-y-1">
          {([
            ["👤", "Tourist",      "Lv 1–4"],
            ["🎒", "Traveler",     "Lv 5–9"],
            ["🧭", "Explorer",     "Lv 10–14"],
            ["🗺️", "Local Guide",  "Lv 15–19"],
            ["⭐", "City Expert",  "Lv 20–24"],
            ["👑", "Legend",       "Lv 25+"],
          ] as const).map(([emoji, title, range]) => (
            <div key={title} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-center">{emoji}</span>
              <span className="text-slate-300 w-24">{title}</span>
              <span className="text-slate-600">{range}</span>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection emoji="🎯" title="Quests">
        <p className="text-slate-400 text-xs leading-relaxed">
          Two daily challenges unlock when you visit your first place: a discovery quest and a category quest. Both expire at midnight. Complete them for XP rewards.
        </p>
      </GuideSection>

      <GuideSection emoji="🏆" title="Achievements">
        <p className="text-slate-400 text-xs leading-relaxed mb-2">
          Milestone badges awarded automatically as you explore. Each one also grants bonus XP.
        </p>
        <div className="space-y-1">
          <AchRow emoji="👣" label="First Steps"     desc="Visit 1 place"    xp={10} />
          <AchRow emoji="🗺️" label="Explorer Fifty"  desc="Visit 50 places"  xp={200} />
          <AchRow emoji="💯" label="Century Club"    desc="Visit 100 places" xp={500} />
          <AchRow emoji="🏃" label="Marathon Walker" desc="Walk 42 km total" xp={500} />
        </div>
      </GuideSection>

      <GuideSection emoji="🎁" title="Mystery Boxes">
        <p className="text-slate-400 text-xs leading-relaxed">
          Awarded every 10 visits. Open a box to reveal a local insight about the neighborhood you just explored.
        </p>
      </GuideSection>

      <GuideSection emoji="📅" title="Trip History">
        <p className="text-slate-400 text-xs leading-relaxed">
          Every route you save in the Planner is recorded here with distance, duration, and a stop-by-stop breakdown.
        </p>
      </GuideSection>
    </div>
  );
}

function GuideSection({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <p className="text-white text-xs font-semibold mb-2 flex items-center gap-1.5">
        <span>{emoji}</span>
        <span>{title}</span>
      </p>
      {children}
    </div>
  );
}

function RarityRow({ emoji, label, desc, color }: { emoji: string; label: string; desc: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span>{emoji}</span>
      <span className={`font-semibold w-20 ${color}`}>{label}</span>
      <span className="text-slate-600">{desc}</span>
    </div>
  );
}

function AchRow({ emoji, label, desc, xp }: { emoji: string; label: string; desc: string; xp: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span>{emoji}</span>
      <span className="text-slate-300 flex-1">{label}</span>
      <span className="text-slate-600 mr-2">{desc}</span>
      <span className="text-ocean-400 font-semibold">+{xp}</span>
    </div>
  );
}

/* ============ Helpers ============ */

function getLevelGradientCSS(title: string): string {
  const map: Record<string, string> = {
    Tourist:       "linear-gradient(135deg, oklch(0.45 0.04 250), oklch(0.35 0.03 250))",
    Traveler:      "linear-gradient(135deg, oklch(0.65 0.14 160), oklch(0.50 0.12 160))",
    Explorer:      "linear-gradient(135deg, oklch(0.65 0.12 205), oklch(0.50 0.10 205))",
    "Local Guide": "linear-gradient(135deg, oklch(0.65 0.16 295), oklch(0.50 0.14 295))",
    "City Expert": "linear-gradient(135deg, oklch(0.65 0.14 22), oklch(0.50 0.12 22))",
    Legend:        "linear-gradient(135deg, oklch(0.75 0.14 88), oklch(0.60 0.14 22))",
  };
  return map[title] ?? map.Tourist;
}

function getLevelEmoji(title: string): string {
  const map: Record<string, string> = {
    Tourist: "👤", Traveler: "🎒", Explorer: "🧭",
    "Local Guide": "🗺️", "City Expert": "⭐", Legend: "👑",
  };
  return map[title] ?? "👤";
}

function getRarityEmoji(rarity: "common" | "rare" | "legendary"): string {
  return { common: "🎫", rare: "✨", legendary: "🌟" }[rarity];
}

function getRarityDistribution(stamps: Stamp[]) {
  const dist = { common: 0, rare: 0, legendary: 0 };
  stamps.forEach((s) => dist[s.rarity]++);
  return (["legendary", "rare", "common"] as const)
    .map((r) => ({ rarity: r, count: dist[r] }))
    .filter((x) => x.count > 0);
}
