"use client";
import { useState, useCallback } from "react";
import { POI } from "@/types";
import { MoodType } from "@/types/gamification";
import { aiApi } from "@/services/api";
import { CATEGORY_CONFIG } from "@/utils/constants";
import { geocodeSearch } from "@/services/nominatim";

interface AIRecommendation {
  name: string;
  category: string;
  reason: string;
}

interface AIRecommendPanelProps {
  selectedPois: POI[];
  onAddToPlanner: (poi: Partial<POI>) => void;
}

const MOODS: { type: MoodType; emoji: string; label: string }[] = [
  { type: "adventurous", emoji: "🏔️", label: "Adventurous" },
  { type: "energetic",   emoji: "⚡", label: "Energetic" },
  { type: "peaceful",    emoji: "🌿", label: "Peaceful" },
  { type: "indulgent",   emoji: "🍰", label: "Indulgent" },
  { type: "creative",    emoji: "🎨", label: "Creative" },
  { type: "social",      emoji: "👥", label: "Social" },
  { type: "intellectual",emoji: "📚", label: "Intellectual" },
  { type: "contemplative",emoji: "🤔", label: "Contemplative" },
];

export default function AIRecommendPanel({ selectedPois, onAddToPlanner }: AIRecommendPanelProps) {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState("");
  const [mood, setMood] = useState<MoodType | null>(null);
  const [fetched, setFetched] = useState(false);
  const [addingIdx, setAddingIdx] = useState<number | null>(null);
  const [addErrors, setAddErrors] = useState<Record<number, string>>({});

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFetched(true);
    setAddErrors({});
    try {
      const input = selectedPois.map((p) => ({
        name: p.name,
        category: p.category,
        address: p.address,
      }));
      const result = await aiApi.getRecommendations(input, preferences || undefined, mood ?? undefined);
      setRecommendations(result.recommendations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI service is unavailable.");
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPois, preferences, mood]);

  const handleAdd = useCallback(async (rec: AIRecommendation, idx: number) => {
    setAddingIdx(idx);
    setAddErrors((prev) => { const n = { ...prev }; delete n[idx]; return n; });

    const context = selectedPois[0]?.address ?? "";
    const query = context ? `${rec.name} near ${context.split(",").slice(-2).join(",")}` : rec.name;

    const results = await geocodeSearch(query, 1);

    if (results.length > 0) {
      onAddToPlanner({
        id: `ai-rec-${idx}-${Date.now()}`,
        name: rec.name,
        category: rec.category as POI["category"],
        address: results[0].displayName.split(",").slice(0, 3).join(","),
        coordinates: results[0].coordinates,
      });
    } else {
      setAddErrors((prev) => ({ ...prev, [idx]: "Couldn't find this place on the map" }));
    }

    setAddingIdx(null);
  }, [selectedPois, onAddToPlanner]);

  const cfg = (cat: string) =>
    CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG.attraction;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex-shrink-0 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-purple-500/[0.2] border border-purple-500/[0.3] flex items-center justify-center text-sm">
              ✨
            </div>
            <h3 className="text-white font-semibold text-sm">AI Recommendations</h3>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">
            Get personalized suggestions based on your planned stops.
          </p>
        </div>

        {/* Mood selector */}
        <div>
          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide mb-1.5">
            Mood
          </p>
          <div className="grid grid-cols-4 gap-1">
            {MOODS.map((m) => (
              <button
                key={m.type}
                onClick={() => setMood(prev => prev === m.type ? null : m.type)}
                title={m.label}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[9px] font-semibold transition-all ${
                  mood === m.type
                    ? "bg-purple-500/[0.2] border-purple-500/[0.4] text-purple-300"
                    : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]"
                }`}
              >
                <span className="text-sm">{m.emoji}</span>
                <span className="truncate w-full text-center">{m.label.slice(0, 5)}</span>
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder="Preferences: budget-friendly, family-friendly, hidden gems…"
          rows={2}
          className="input-glass text-xs resize-none"
        />

        <button
          onClick={fetchRecommendations}
          disabled={loading || selectedPois.length === 0}
          className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Generating…
            </>
          ) : "Get AI Suggestions"}
        </button>

        {selectedPois.length === 0 && (
          <p className="text-slate-600 text-[11px] text-center">
            Add at least one stop to your plan first.
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {error && (
          <div className="bg-red-500/[0.1] border border-red-500/[0.2] rounded-xl px-3 py-2.5 space-y-0.5">
            <p className="text-red-400 text-xs font-semibold">Request failed</p>
            <p className="text-red-500 text-[11px] leading-relaxed">{error}</p>
            <p className="text-red-600 text-[10px]">Check NVIDIA_API_KEY in backend/.env</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 skeleton rounded-lg" />
                  <div className="h-3.5 skeleton rounded-full w-2/3" />
                </div>
                <div className="h-2.5 skeleton rounded-full w-1/3" />
                <div className="space-y-1">
                  <div className="h-2 skeleton rounded-full" />
                  <div className="h-2 skeleton rounded-full w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {fetched && !loading && !error && recommendations.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">No recommendations returned</p>
            <p className="text-slate-600 text-xs mt-1">Try different preferences or add more stops</p>
          </div>
        )}

        {!loading && recommendations.map((rec, i) => {
          const c = cfg(rec.category);
          const isAdding = addingIdx === i;
          const addErr = addErrors[i];
          return (
            <div
              key={i}
              className="glass-card p-3 animate-fade-in"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base flex-shrink-0">{c.emoji}</span>
                  <span className="text-white text-sm font-semibold truncate">{rec.name}</span>
                </div>
                <button
                  onClick={() => handleAdd(rec, i)}
                  disabled={isAdding}
                  className="text-ocean-400 text-xs font-semibold hover:text-ocean-300 transition-colors flex-shrink-0 ml-2 disabled:opacity-50 flex items-center gap-1"
                >
                  {isAdding ? (
                    <span className="w-3 h-3 rounded-full border-2 border-ocean-400 border-t-transparent animate-spin block" />
                  ) : "+ Add"}
                </button>
              </div>

              <span className={`badge ${c.bgColor} ${c.borderColor} border ${c.color} text-[10px] mb-2`}>
                {rec.category}
              </span>

              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{rec.reason}</p>

              {addErr && (
                <p className="text-amber-500 text-[10px] mt-1.5">{addErr} — try searching manually</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
