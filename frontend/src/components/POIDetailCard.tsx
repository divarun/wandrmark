"use client";
import { useState } from "react";
import { POI } from "@/types";
import { CATEGORY_CONFIG } from "@/utils/constants";
import { useFavorites } from "@/hooks/useFavorites";
import { aiApi } from "@/services/api";

interface POIDetailCardProps {
  poi: POI;
  onClose: () => void;
  onAddToPlanner: (poi: POI) => void;
}

export default function POIDetailCard({ poi, onClose, onAddToPlanner }: POIDetailCardProps) {
  const cfg = CATEGORY_CONFIG[poi.category];
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [aiTips, setAiTips] = useState<{ description: string; tips: string[]; localInsights: string } | null>(null);
  const [loadingTips, setLoadingTips] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const fav = isFavorite(poi.id);

  const toggleFav = () => {
    fav ? removeFavorite(poi.id) : addFavorite(poi);
  };

  const fetchTips = async () => {
    if (aiTips) { setAiTips(null); return; }
    setLoadingTips(true);
    setAiError(null);
    try {
      const result = await aiApi.getTravelTips({
        name: poi.name,
        category: poi.category,
        address: poi.address,
      });
      setAiTips(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI service unavailable");
    } finally {
      setLoadingTips(false);
    }
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={
              i < full ? "text-amber-400 text-sm" :
              (half && i === full) ? "text-amber-400 opacity-50 text-sm" :
              "text-slate-700 text-sm"
            }
          >★</span>
        ))}
        <span className="text-slate-500 text-xs ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md mx-0 sm:mx-4 rounded-t-3xl sm:rounded-3xl border border-white/[0.09] shadow-modal animate-slide-up sm:animate-scale-in max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div
          className="h-1 rounded-t-3xl sm:rounded-t-3xl"
          style={{ background: `linear-gradient(90deg, ${cfg.markerColor} 0%, transparent 80%)` }}
        />

        <div className="p-5">
          {/* Top row */}
          <div className="flex items-start justify-between mb-4">
            <span className={`badge ${cfg.bgColor} ${cfg.borderColor} border ${cfg.color} text-xs`}>
              <span>{cfg.emoji}</span>
              <span>{cfg.label.replace(/s$/, "")}</span>
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          {/* Name & rating */}
          <h2 className="font-display text-xl font-bold text-white mb-1.5 leading-tight">{poi.name}</h2>
          {poi.rating && <div className="mb-3">{renderStars(poi.rating)}</div>}

          {/* Address */}
          <div className="flex items-start gap-2 text-slate-400 text-sm mb-3">
            <span className="text-slate-500 mt-0.5 flex-shrink-0">📍</span>
            <p className="leading-relaxed">{poi.address}</p>
          </div>

          {/* Opening hours */}
          {poi.openingHours && (
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
              <span className="text-slate-500 flex-shrink-0">🕐</span>
              <p className="italic">{poi.openingHours}</p>
            </div>
          )}

          {/* Tags */}
          {poi.tags && poi.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-4">
              {poi.tags.map((tag) => (
                <span key={tag} className="badge bg-white/[0.05] border border-white/[0.08] text-slate-400 text-[11px]">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <button
              onClick={toggleFav}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                fav
                  ? "bg-coral-500/[0.15] border-coral-500/[0.35] text-coral-400"
                  : "bg-white/[0.05] border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.09]"
              }`}
            >
              <span>{fav ? "♥" : "♡"}</span>
              <span>{fav ? "Saved" : "Save"}</span>
            </button>
            <button
              onClick={() => { onAddToPlanner(poi); onClose(); }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-ocean-600/[0.2] border border-ocean-600/[0.35] text-ocean-300 hover:text-white hover:bg-ocean-600/[0.35] text-sm font-semibold transition-all duration-200"
            >
              <span>+</span>
              <span>Add to Plan</span>
            </button>
          </div>

          {/* AI Insights */}
          <div className="border-t border-white/[0.06] pt-4">
            <button
              onClick={fetchTips}
              disabled={loadingTips}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all disabled:opacity-60 group"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <span className="w-6 h-6 rounded-lg bg-purple-500/[0.2] border border-purple-500/[0.3] flex items-center justify-center text-xs flex-shrink-0">✨</span>
                AI Travel Insights
              </span>
              <span className="text-slate-500 text-xs">
                {loadingTips ? (
                  <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin block" />
                ) : aiTips ? "▲" : "▼"}
              </span>
            </button>

            {aiError && (
              <div className="mt-2 bg-red-500/[0.1] border border-red-500/[0.2] rounded-xl px-3 py-2">
                <p className="text-red-400 text-xs">{aiError}</p>
              </div>
            )}

            {/* AI tips skeleton */}
            {loadingTips && !aiTips && (
              <div className="mt-3 space-y-2 animate-fade-in">
                <div className="h-3 skeleton rounded-full w-full" />
                <div className="h-3 skeleton rounded-full w-5/6" />
                <div className="h-3 skeleton rounded-full w-4/6" />
              </div>
            )}

            {aiTips && (
              <div className="mt-3 space-y-3 animate-fade-in">
                <p className="text-slate-300 text-sm leading-relaxed">{aiTips.description}</p>
                <div className="bg-ocean-500/[0.07] border border-ocean-500/[0.15] rounded-xl p-3">
                  <p className="text-ocean-300 text-xs font-semibold mb-1.5">💡 Local Insights</p>
                  <p className="text-slate-400 text-xs leading-relaxed">{aiTips.localInsights}</p>
                </div>
                {aiTips.tips.length > 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <p className="text-slate-400 text-xs font-semibold mb-2">📝 Tips</p>
                    <ul className="space-y-1.5">
                      {aiTips.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-ocean-500 text-xs mt-0.5 flex-shrink-0">•</span>
                          <span className="text-slate-400 text-xs leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
