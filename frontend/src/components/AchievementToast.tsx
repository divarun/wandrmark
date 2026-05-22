"use client";
import { useEffect, useState } from "react";
import { Achievement, Badge, Stamp, ExplorerTitle } from "@/types/gamification";

interface ToastNotification {
  id: string;
  type: "achievement" | "badge" | "stamp" | "levelUp" | "xp" | "info";
  data: any;
}

let toastQueue: ToastNotification[] = [];
let notifyListeners: (() => void)[] = [];

export function showAchievementToast(achievement: Achievement) {
  const toast: ToastNotification = {
    id: `achievement_${Date.now()}_${Math.random()}`,
    type: "achievement",
    data: achievement,
  };
  toastQueue.push(toast);
  notifyListeners.forEach((fn) => fn());
}

export function showBadgeToast(badge: Badge) {
  const toast: ToastNotification = {
    id: `badge_${Date.now()}_${Math.random()}`,
    type: "badge",
    data: badge,
  };
  toastQueue.push(toast);
  notifyListeners.forEach((fn) => fn());
}

export function showStampToast(stamp: Stamp) {
  const toast: ToastNotification = {
    id: `stamp_${Date.now()}_${Math.random()}`,
    type: "stamp",
    data: stamp,
  };
  toastQueue.push(toast);
  notifyListeners.forEach((fn) => fn());
}

export function showLevelUpToast(newLevel: number, newTitle: ExplorerTitle) {
  const toast: ToastNotification = {
    id: `levelup_${Date.now()}_${Math.random()}`,
    type: "levelUp",
    data: { level: newLevel, title: newTitle },
  };
  toastQueue.push(toast);
  notifyListeners.forEach((fn) => fn());
}

export function showInfoToast(message: string, icon = "ℹ️") {
  const toast: ToastNotification = {
    id: `info_${Date.now()}_${Math.random()}`,
    type: "info",
    data: { message, icon },
  };
  toastQueue.push(toast);
  notifyListeners.forEach((fn) => fn());
}

export function showXPToast(xpGained: number) {
  const toast: ToastNotification = {
    id: `xp_${Date.now()}_${Math.random()}`,
    type: "xp",
    data: { xp: xpGained },
  };
  toastQueue.push(toast);
  notifyListeners.forEach((fn) => fn());
}

export default function AchievementToast() {
  const [activeToasts, setActiveToasts] = useState<ToastNotification[]>([]);

  useEffect(() => {
    const updateToasts = () => {
      setActiveToasts([...toastQueue]);
    };

    notifyListeners.push(updateToasts);

    return () => {
      notifyListeners = notifyListeners.filter((fn) => fn !== updateToasts);
    };
  }, []);

  const removeToast = (id: string) => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    setActiveToasts([...toastQueue]);
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {activeToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastNotification; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onRemove, 300);
    }, toast.type === "xp" || toast.type === "info" ? 2000 : 4000);

    return () => clearTimeout(timer);
  }, [onRemove, toast.type]);

  const getToastContent = () => {
    switch (toast.type) {
      case "achievement":
        return <AchievementContent achievement={toast.data} />;
      case "badge":
        return <BadgeContent badge={toast.data} />;
      case "stamp":
        return <StampContent stamp={toast.data} />;
      case "levelUp":
        return <LevelUpContent level={toast.data.level} title={toast.data.title} />;
      case "xp":
        return <XPContent xp={toast.data.xp} />;
      case "info":
        return <InfoContent message={toast.data.message} icon={toast.data.icon} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`
        pointer-events-auto
        transition-all duration-300
        ${isExiting ? "opacity-0 translate-y-[-10px]" : "opacity-100 translate-y-0"}
      `}
    >
      {getToastContent()}
    </div>
  );
}

function AchievementContent({ achievement }: { achievement: Achievement }) {
  const tierColors = {
    bronze: "from-amber-700/[0.9] to-amber-800/[0.9] border-amber-600",
    silver: "from-slate-400/[0.9] to-slate-500/[0.9] border-slate-400",
    gold: "from-amber-400/[0.9] to-amber-500/[0.9] border-amber-400",
    platinum: "from-ocean-400/[0.9] to-ocean-500/[0.9] border-ocean-400",
  };

  return (
    <div
      className={`
        bg-gradient-to-r ${tierColors[achievement.tier]}
        border-2 rounded-xl px-4 py-3
        shadow-2xl backdrop-blur-sm
        min-w-[300px] max-w-[400px]
        animate-bounce-in
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-4xl">{achievement.iconEmoji}</span>
        <div className="flex-1">
          <p className="text-white font-bold text-sm mb-0.5">Achievement Unlocked!</p>
          <p className="text-white font-semibold text-base">{achievement.name}</p>
          <p className="text-white/80 text-xs mt-0.5">{achievement.description}</p>
          <p className="text-white/90 text-xs font-semibold mt-1">+{achievement.reward.xp} XP</p>
        </div>
      </div>
    </div>
  );
}

function BadgeContent({ badge }: { badge: Badge }) {
  const rarityColors = {
    bronze: "from-amber-700/[0.9] to-amber-800/[0.9] border-amber-600",
    silver: "from-slate-400/[0.9] to-slate-500/[0.9] border-slate-400",
    gold: "from-amber-400/[0.9] to-amber-500/[0.9] border-amber-400",
    platinum: "from-ocean-400/[0.9] to-ocean-500/[0.9] border-ocean-400",
  };

  return (
    <div
      className={`
        bg-gradient-to-r ${rarityColors[badge.rarity]}
        border-2 rounded-xl px-4 py-3
        shadow-2xl backdrop-blur-sm
        min-w-[300px] max-w-[400px]
        animate-bounce-in
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-4xl">{badge.iconEmoji}</span>
        <div className="flex-1">
          <p className="text-white font-bold text-sm mb-0.5">Badge Earned!</p>
          <p className="text-white font-semibold text-base">{badge.name}</p>
          <p className="text-white/80 text-xs mt-0.5">{badge.description}</p>
        </div>
      </div>
    </div>
  );
}

function StampContent({ stamp }: { stamp: Stamp }) {
  const rarityColors = {
    common: "from-slate-600/[0.9] to-slate-700/[0.9] border-slate-500",
    rare: "from-ocean-500/[0.9] to-ocean-600/[0.9] border-ocean-400",
    legendary: "from-amber-400/[0.9] to-amber-500/[0.9] border-amber-400",
  };

  const rarityLabels = {
    common: "Common Stamp",
    rare: "Rare Stamp",
    legendary: "Legendary Stamp",
  };

  const rarityEmojis = {
    common: "🎫",
    rare: "✨",
    legendary: "🌟",
  };

  return (
    <div
      className={`
        bg-gradient-to-r ${rarityColors[stamp.rarity]}
        border-2 rounded-xl px-4 py-3
        shadow-2xl backdrop-blur-sm
        min-w-[320px] max-w-[420px]
        animate-bounce-in
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-4xl">{rarityEmojis[stamp.rarity]}</span>
        <div className="flex-1">
          <p className="text-white font-bold text-sm mb-0.5">{rarityLabels[stamp.rarity]} Collected!</p>
          <p className="text-white font-semibold text-base">{stamp.neighborhoodName}</p>
          <p className="text-white/80 text-xs">{stamp.cityName}, {stamp.countryCode}</p>
          {stamp.aiDescription && (
            <p className="text-white/90 text-xs mt-2 leading-relaxed italic">
              {stamp.aiDescription.length > 120
                ? stamp.aiDescription.substring(0, 120) + "..."
                : stamp.aiDescription}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LevelUpContent({ level, title }: { level: number; title: ExplorerTitle }) {
  const titleEmojis = {
    Tourist: "👤",
    Traveler: "🎒",
    Explorer: "🧭",
    "Local Guide": "🗺️",
    "City Expert": "⭐",
    Legend: "👑",
  };

  return (
    <div
      className={`
        bg-gradient-to-r from-purple-500/[0.9] to-purple-600/[0.9]
        border-2 border-purple-400 rounded-xl px-4 py-3
        shadow-2xl backdrop-blur-sm
        min-w-[300px] max-w-[400px]
        animate-bounce-in
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-4xl">{titleEmojis[title]}</span>
        <div className="flex-1">
          <p className="text-white font-bold text-sm mb-0.5">Level Up!</p>
          <p className="text-white font-semibold text-lg">Level {level}</p>
          <p className="text-white/90 text-base">{title}</p>
        </div>
      </div>
    </div>
  );
}

function XPContent({ xp }: { xp: number }) {
  return (
    <div
      className={`
        bg-gradient-to-r from-emerald-500/[0.9] to-emerald-600/[0.9]
        border-2 border-emerald-400 rounded-xl px-4 py-2
        shadow-2xl backdrop-blur-sm
        min-w-[200px]
        animate-slide-in
      `}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-2xl">✨</span>
        <p className="text-white font-bold text-base">+{xp} XP</p>
      </div>
    </div>
  );
}

function InfoContent({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="bg-slate-800/95 border border-white/[0.12] rounded-xl px-4 py-2.5 shadow-2xl backdrop-blur-sm min-w-[220px] animate-slide-up">
      <div className="flex items-center gap-2.5">
        <span className="text-base flex-shrink-0">{icon}</span>
        <p className="text-slate-200 text-sm">{message}</p>
      </div>
    </div>
  );
}