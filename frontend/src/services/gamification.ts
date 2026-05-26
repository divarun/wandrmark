import { POI, POICategory, LatLng, RouteSegment } from "@/types";
import {
  ExplorerPassport,
  Stamp,
  Badge,
  Quest,
  Achievement,
  MysteryBox,
  ExplorerTitle,
  PassportStatistics,
  UserProgress,
  TripMemory,
  MoodType,
} from "@/types/gamification";
import { reverseGeocode } from "./nominatim";

import COUNTRIES from "@/data/countries.json";
import MAJOR_CITIES from "@/data/majorCities.json";
import TOURIST_HOTSPOTS from "@/data/touristHotspots.json";

/* ============================================
   CONSTANTS
============================================ */

const STORAGE_KEY_PROGRESS = "wandrmark_user_progress";
const STORAGE_KEY_VISITED_POIS = "wandrmark_visited_pois";
const STORAGE_KEY_TRIP_HISTORY = "wandrmark_trip_history";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api";

/* ============================================
   ACHIEVEMENT DEFINITIONS
============================================ */

export const ACHIEVEMENT_LIBRARY: Achievement[] = [
  // ── POI milestones ───────────────────────────────────────
  {
    id: "first_steps",
    name: "First Steps",
    description: "Visit your first place",
    category: "pois",
    iconEmoji: "👣",
    requirement: { type: "pois_visited", target: 1 },
    reward: { xp: 10 },
    tier: "bronze",
  },
  {
    id: "explorer_five",
    name: "Getting Warmed Up",
    description: "Visit 5 places",
    category: "pois",
    iconEmoji: "🚶",
    requirement: { type: "pois_visited", target: 5 },
    reward: { xp: 25 },
    tier: "bronze",
  },
  {
    id: "explorer_ten",
    name: "On the Move",
    description: "Visit 10 places",
    category: "pois",
    iconEmoji: "🏃",
    requirement: { type: "pois_visited", target: 10 },
    reward: { xp: 50 },
    tier: "bronze",
  },
  {
    id: "explorer_twentyfive",
    name: "Neighborhood Regular",
    description: "Visit 25 places",
    category: "pois",
    iconEmoji: "🧭",
    requirement: { type: "pois_visited", target: 25 },
    reward: { xp: 100 },
    tier: "silver",
  },
  {
    id: "explorer_fifty",
    name: "Explorer Fifty",
    description: "Visit 50 places",
    category: "pois",
    iconEmoji: "🗺️",
    requirement: { type: "pois_visited", target: 50 },
    reward: { xp: 200 },
    tier: "silver",
  },
  {
    id: "century_club",
    name: "Century Club",
    description: "Visit 100 places",
    category: "pois",
    iconEmoji: "💯",
    requirement: { type: "pois_visited", target: 100 },
    reward: { xp: 500 },
    tier: "gold",
  },
  {
    id: "road_warrior",
    name: "Road Warrior",
    description: "Visit 200 places",
    category: "pois",
    iconEmoji: "🏆",
    requirement: { type: "pois_visited", target: 200 },
    reward: { xp: 1000 },
    tier: "gold",
  },
  {
    id: "legend_explorer",
    name: "Living Legend",
    description: "Visit 500 places",
    category: "pois",
    iconEmoji: "👑",
    requirement: { type: "pois_visited", target: 500 },
    reward: { xp: 2500 },
    tier: "platinum",
  },

  // ── City milestones ──────────────────────────────────────
  {
    id: "city_hopper",
    name: "City Hopper",
    description: "Explore 3 different cities",
    category: "pois",
    iconEmoji: "✈️",
    requirement: { type: "cities_visited", target: 3 },
    reward: { xp: 75 },
    tier: "bronze",
  },
  {
    id: "globetrotter",
    name: "Globetrotter",
    description: "Explore 5 different cities",
    category: "pois",
    iconEmoji: "🌍",
    requirement: { type: "cities_visited", target: 5 },
    reward: { xp: 150 },
    tier: "silver",
  },
  {
    id: "world_traveler",
    name: "World Traveler",
    description: "Explore 10 different cities",
    category: "pois",
    iconEmoji: "🌐",
    requirement: { type: "cities_visited", target: 10 },
    reward: { xp: 400 },
    tier: "gold",
  },

  // ── Quest milestones ─────────────────────────────────────
  {
    id: "quest_beginner",
    name: "Quest Beginner",
    description: "Complete 5 quests",
    category: "pois",
    iconEmoji: "🎯",
    requirement: { type: "quests_completed", target: 5 },
    reward: { xp: 50 },
    tier: "bronze",
  },
  {
    id: "quest_master",
    name: "Quest Master",
    description: "Complete 10 quests",
    category: "pois",
    iconEmoji: "⭐",
    requirement: { type: "quests_completed", target: 10 },
    reward: { xp: 150 },
    tier: "silver",
  },
  {
    id: "quest_legend",
    name: "Quest Legend",
    description: "Complete 25 quests",
    category: "pois",
    iconEmoji: "🌟",
    requirement: { type: "quests_completed", target: 25 },
    reward: { xp: 500 },
    tier: "gold",
  },

  // ── Streak milestones ────────────────────────────────────
  {
    id: "streak_three",
    name: "Habit Forming",
    description: "Explore 3 days in a row",
    category: "streak",
    iconEmoji: "🔥",
    requirement: { type: "streak_days", target: 3 },
    reward: { xp: 30 },
    tier: "bronze",
  },
  {
    id: "streak_week",
    name: "Week Wanderer",
    description: "Explore 7 days in a row",
    category: "streak",
    iconEmoji: "📅",
    requirement: { type: "streak_days", target: 7 },
    reward: { xp: 100 },
    tier: "silver",
  },
  {
    id: "streak_fortnight",
    name: "Dedicated Explorer",
    description: "Explore 14 days in a row",
    category: "streak",
    iconEmoji: "💪",
    requirement: { type: "streak_days", target: 14 },
    reward: { xp: 250 },
    tier: "gold",
  },
  {
    id: "streak_month",
    name: "Unstoppable",
    description: "Explore 30 days in a row",
    category: "streak",
    iconEmoji: "⚡",
    requirement: { type: "streak_days", target: 30 },
    reward: { xp: 750 },
    tier: "platinum",
  },

  // ── Route milestones ─────────────────────────────────────
  {
    id: "first_route",
    name: "Route Planner",
    description: "Save your first planned route",
    category: "pois",
    iconEmoji: "🗓️",
    requirement: { type: "routes_completed", target: 1 },
    reward: { xp: 50 },
    tier: "bronze",
  },
  {
    id: "five_routes",
    name: "Master Planner",
    description: "Save 5 planned routes",
    category: "pois",
    iconEmoji: "🗺️",
    requirement: { type: "routes_completed", target: 5 },
    reward: { xp: 200 },
    tier: "silver",
  },
];

/* ============================================
   QUEST GENERATORS
============================================ */

export function generateDailyQuests(cityName: string): Quest[] {
  return [
    {
      id: `daily_discovery_${Date.now()}`,
      title: "Daily Discovery",
      description: `Find and visit 3 new places in ${cityName} today`,
      type: "discovery",
      difficulty: "easy",
      requirements: [
        {
          id: "req_1",
          type: "visit_pois",
          target: 3,
          current: 0,
          details: { timeWindow: "today" },
          description: "Visit 3 POIs",
        },
      ],
      reward: { xp: 50, mysteryBox: true },
      progress: 0,
      isActive: true,
      isCompleted: false,
      expiresAt: getEndOfDay(),
      aiGenerated: false,
      cityName,
    },
  ];
}

function generateCategoryQuest(cityName: string): Quest {
  const options: { category: POICategory; emoji: string }[] = [
    { category: "restaurant", emoji: "🍽️" },
    { category: "cafe", emoji: "☕" },
    { category: "attraction", emoji: "🏛️" },
    { category: "park", emoji: "🌳" },
    { category: "museum", emoji: "🎨" },
  ];
  const pick = options[Math.floor(Math.random() * options.length)];
  const label = pick.category.charAt(0).toUpperCase() + pick.category.slice(1);
  return {
    id: `category_${pick.category}_${Date.now()}`,
    title: `${pick.emoji} ${label} Seeker`,
    description: `Find a ${pick.category} in ${cityName} and tap it on the map to visit`,
    type: "category",
    difficulty: "easy",
    requirements: [
      {
        id: "req_cat",
        type: "visit_categories",
        target: 1,
        current: 0,
        details: { category: pick.category, emoji: pick.emoji },
        description: `Visit 1 ${pick.category}`,
      },
    ],
    reward: { xp: 75 },
    progress: 0,
    isActive: true,
    isCompleted: false,
    expiresAt: getEndOfDay(),
    aiGenerated: false,
    cityName,
  };
}

/* ============================================
   XP CONSTANTS
============================================ */

const XP_BY_CATEGORY: Record<string, number> = {
  restaurant: 10,
  cafe: 8,
  attraction: 25,
  museum: 25,
  park: 12,
};

const XP_RARITY_MULTIPLIER: Record<string, number> = {
  common: 1,
  rare: 1.5,
  legendary: 3,
};

/* ============================================
   RARITY CALCULATION
============================================ */

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function calculateStampRarity(
  cityName: string,
  neighborhoodName: string,
  countryCode: string
): "common" | "rare" | "legendary" {
  const city = normalize(cityName);
  const neighborhood = normalize(neighborhoodName);

  // Word-boundary match: avoid "Washington" matching "Port Washington" or "Washington Township"
  const matchedCity = MAJOR_CITIES.find(c => {
    const nc = normalize(c);
    const idx = city.indexOf(nc);
    if (idx === -1) return false;
    const before = city[idx - 1];
    const after = city[idx + nc.length];
    return (!before || /\W/.test(before)) && (!after || /\W/.test(after));
  });
  if (!matchedCity) return "legendary";

  const hotspots = (TOURIST_HOTSPOTS as Record<string, string[]>)[matchedCity];
  if (hotspots?.some(h => neighborhood.includes(normalize(h)))) return "common";

  return "rare";
}

/* ============================================
   CORE GAMIFICATION SERVICE
============================================ */

class GamificationService {
  private progress: UserProgress | null = null;
  private visitedPOIs: Set<string> = new Set();
  private tripHistory: TripMemory[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.loadProgress();
      this.loadVisitedPOIs();
      this.loadTripHistory();
    }
  }

  getProgress(): UserProgress | null {
    return this.progress;
  }

  getVisitedPOIIds(): Set<string> {
    return new Set(this.visitedPOIs);
  }

  getTripHistory(): TripMemory[] {
    return [...this.tripHistory];
  }

  /* ---------- MYSTERY BOX ---------- */

  public openMysteryBox(boxId: string): void {
    if (!this.progress) return;
    const box = this.progress.mysteryBoxes.find(b => b.id === boxId);
    if (box && !box.opened) {
      box.opened = true;
      this.saveProgress();
    }
  }

  /* ---------- TRIP MEMORY ---------- */

  public saveTripMemory(data: {
    cityName: string;
    poisVisited: POI[];
    route?: RouteSegment[];
    distance: number;
    duration: number;
    notes?: string;
    mood?: MoodType;
  }): Achievement[] {
    const memory: TripMemory = {
      id: `trip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      date: new Date(),
      cityName: data.cityName,
      poisVisited: data.poisVisited,
      route: data.route,
      distance: data.distance,
      duration: data.duration,
      notes: data.notes,
      mood: data.mood,
      achievements: this.progress?.achievements.slice(-3) ?? [],
      questsCompleted: this.progress?.completedQuests.slice(-2) ?? [],
    };
    this.tripHistory.unshift(memory); // newest first
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_TRIP_HISTORY, JSON.stringify(this.tripHistory));
    }

    if (this.progress) {
      this.progress.passport.statistics.routesCompleted++;
    }
    const newAchievements = this.checkAchievements();
    this.saveProgress();
    return newAchievements;
  }

  /* ---------- COUNTRY DETECTION ---------- */

  private detectCountryCode(
    address?: string,
    countryFromGeocode?: string
  ): string {
    if (countryFromGeocode && (COUNTRIES.countries as Record<string, unknown>)[countryFromGeocode]) {
      return countryFromGeocode;
    }

    if (!address) return COUNTRIES.defaultCountryCode;

    const addressLower = address.toLowerCase();

    for (const [code, country] of Object.entries(COUNTRIES.countries)) {
      if (country.aliases?.some(alias => addressLower.includes(alias))) {
        return code;
      }
    }

    return COUNTRIES.defaultCountryCode;
  }

  /* ---------- LOCATION PARSING ---------- */

  private parseLocation(
    locationString: string,
    poi: POI
  ): { neighborhood: string; city: string; countryCode: string } {
    const parts = locationString.split(",").map(p => p.trim());

    const neighborhood = parts[0] || "";
    const city = parts[1] || parts[0] || "";

    const countryPart = parts[parts.length - 1]?.toLowerCase();
    let countryFromGeocode: string | undefined;

    for (const [code, country] of Object.entries(COUNTRIES.countries)) {
      if (
        country.name.toLowerCase() === countryPart ||
        country.aliases?.includes(countryPart)
      ) {
        countryFromGeocode = code;
        break;
      }
    }

    const countryCode = this.detectCountryCode(poi.address, countryFromGeocode);
    return { neighborhood, city, countryCode };
  }

  /* ---------- STAMP CREATION ---------- */

  private async createStamp(poi: POI): Promise<Stamp | null> {
    if (!this.progress) return null;

    const locationString = await reverseGeocode(poi.coordinates);
    const { neighborhood, city, countryCode } =
      this.parseLocation(locationString, poi);

    if (!neighborhood || !city) return null;

    const rarity = calculateStampRarity(city, neighborhood, countryCode);

    return {
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      neighborhoodName: neighborhood,
      cityName: city,
      countryCode,
      coordinates: poi.coordinates,
      earnedAt: new Date(),
      uniquePOIsVisited: 1,
      rarity,
      aiDescription: `${neighborhood} is a distinctive part of ${city}.`,
    };
  }

  /* ---------- VISIT POI ---------- */

  public async visitPOI(poi: POI): Promise<{
    isNew: boolean;
    xpGained: number;
    leveledUp: boolean;
    newLevel?: string;
    newLevelNum?: number;
    achievements: Achievement[];
    mysteryBox?: MysteryBox;
    completedQuests: Quest[];
  }> {
    const isNew = !this.visitedPOIs.has(poi.id);

    if (!isNew) {
      return { isNew: false, xpGained: 0, leveledUp: false, achievements: [], completedQuests: [] };
    }

    this.visitedPOIs.add(poi.id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_VISITED_POIS, JSON.stringify([...this.visitedPOIs]));
    }

    if (!this.progress) {
      this.progress = this.createNewProgress();
    }

    const stamp = await this.createStamp(poi);
    if (stamp) {
      const isNewCity = !this.progress.passport.stamps.some(s => s.cityName === stamp.cityName);
      this.progress.passport.stamps.push(stamp);
      this.ensureDailyQuests(stamp.cityName);
      if (isNewCity) {
        this.progress.passport.statistics.citiesVisited++;
      }
    }

    const stats = this.progress.passport.statistics;
    stats.poisVisited++;
    this.updateStreak(stats);

    const baseXP = XP_BY_CATEGORY[poi.category] ?? 10;
    const rarityMultiplier = stamp ? (XP_RARITY_MULTIPLIER[stamp.rarity] ?? 1) : 1;
    const xpGained = Math.round(baseXP * rarityMultiplier);
    const level = this.progress.passport.level;
    let newXP = level.xp + xpGained;

    let leveledUp = false;
    let newLevel: string | undefined;

    let newLevelNum: number | undefined;

    if (newXP >= level.xpToNextLevel) {
      level.level++;
      level.xp = newXP - level.xpToNextLevel;
      level.xpToNextLevel = this.calculateNextLevelXP(level.level);
      level.title = this.getExplorerTitle(level.level) as ExplorerTitle;
      leveledUp = true;
      newLevel = level.title;
      newLevelNum = level.level;
    } else {
      level.xp = newXP;
    }

    const achievements = this.checkAchievements();
    const completedQuests = this.updateQuestProgress(poi);

    for (const quest of completedQuests) {
      this.applyXP(quest.reward.xp);
    }

    const mysteryBox = stats.poisVisited % 10 === 0 ? this.generateMysteryBox() : undefined;
    if (mysteryBox) {
      this.progress.mysteryBoxes.push(mysteryBox);
    }

    this.saveProgress();

    return { isNew, xpGained, leveledUp, newLevel, newLevelNum, achievements, mysteryBox, completedQuests };
  }

  private ensureDailyQuests(cityName: string): void {
    if (!this.progress) return;
    const now = new Date();

    // Prune expired quests
    this.progress.activeQuests = this.progress.activeQuests.filter(
      q => !q.expiresAt || new Date(q.expiresAt) > now
    );

    // Generate fresh daily + category quests if the slate is empty
    if (this.progress.activeQuests.length === 0) {
      this.progress.activeQuests.push(
        ...generateDailyQuests(cityName),
        generateCategoryQuest(cityName),
      );
    }
  }

  private updateQuestProgress(poi: POI): Quest[] {
    if (!this.progress) return [];
    const now = new Date();
    const completed: Quest[] = [];

    for (const quest of this.progress.activeQuests) {
      if (quest.isCompleted) continue;
      if (quest.expiresAt && new Date(quest.expiresAt) < now) continue;

      for (const req of quest.requirements) {
        if (req.type === "visit_pois") {
          req.current = Math.min(req.current + 1, req.target);
        } else if (req.type === "visit_categories" && req.details?.category === poi.category) {
          req.current = Math.min(req.current + 1, req.target);
        }
      }

      const totalTarget = quest.requirements.reduce((s, r) => s + r.target, 0);
      const totalCurrent = quest.requirements.reduce((s, r) => s + r.current, 0);
      quest.progress = Math.round((totalCurrent / totalTarget) * 100);

      if (totalCurrent >= totalTarget) {
        quest.isCompleted = true;
        completed.push(quest);
        this.progress.passport.statistics.questsCompleted++;
      }
    }

    if (completed.length > 0) {
      this.progress.activeQuests = this.progress.activeQuests.filter(q => !q.isCompleted);
      this.progress.completedQuests.push(...completed);
    }

    return completed;
  }

  /* ---------- XP ---------- */

  private applyXP(amount: number): void {
    if (!this.progress || amount <= 0) return;
    const lvl = this.progress.passport.level;
    lvl.xp += amount;
    while (lvl.xp >= lvl.xpToNextLevel) {
      lvl.level++;
      lvl.xp -= lvl.xpToNextLevel;
      lvl.xpToNextLevel = this.calculateNextLevelXP(lvl.level);
      lvl.title = this.getExplorerTitle(lvl.level) as ExplorerTitle;
    }
  }

  /* ---------- LEVELING ---------- */

  private calculateNextLevelXP(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  private getExplorerTitle(level: number): ExplorerTitle {
    const titles: ExplorerTitle[] = [
      "Tourist",
      "Traveler",
      "Explorer",
      "Local Guide",
      "City Expert",
      "Legend",
    ];
    const index = Math.min(Math.floor(level / 5), titles.length - 1);
    return titles[index];
  }

  /* ---------- ACHIEVEMENTS ---------- */

  private checkAchievements(): Achievement[] {
    if (!this.progress) return [];

    const newAchievements: Achievement[] = [];
    const stats = this.progress.passport.statistics;

    for (const achievement of ACHIEVEMENT_LIBRARY) {
      if (this.progress.achievements.some(a => a.id === achievement.id)) {
        continue;
      }

      let met = false;
      switch (achievement.requirement.type) {
        case "pois_visited":
          met = stats.poisVisited >= achievement.requirement.target;
          break;
        case "cities_visited":
          met = stats.citiesVisited >= achievement.requirement.target;
          break;
        case "quests_completed":
          met = stats.questsCompleted >= achievement.requirement.target;
          break;
        case "streak_days":
          met = stats.longestStreak >= achievement.requirement.target;
          break;
        case "routes_completed":
          met = stats.routesCompleted >= achievement.requirement.target;
          break;
      }

      if (met) {
        this.progress.achievements.push(achievement);
        newAchievements.push(achievement);
        this.applyXP(achievement.reward.xp);
      }
    }

    return newAchievements;
  }

  /* ---------- STREAK TRACKING ---------- */

  private updateStreak(stats: { currentStreak: number; longestStreak: number; lastActiveDate: Date }): void {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const lastActive = new Date(stats.lastActiveDate);
    const lastStart = new Date(lastActive); lastStart.setHours(0, 0, 0, 0);
    const daysDiff = Math.round((todayStart.getTime() - lastStart.getTime()) / 86400000);

    if (daysDiff === 1) {
      stats.currentStreak++;
      if (stats.currentStreak > stats.longestStreak) stats.longestStreak = stats.currentStreak;
    } else if (daysDiff > 1) {
      stats.currentStreak = 1;
    }
    // daysDiff === 0: same calendar day, no change to streak

    stats.lastActiveDate = now;
  }

  /* ---------- MYSTERY BOX GENERATION ---------- */

  private generateMysteryBox(): MysteryBox {
    const roll = Math.random();
    let rarity: MysteryBox["rarity"];
    let xpBonus: number;
    let content: string;
    let type: MysteryBox["reward"]["type"];

    if (roll < 0.60) {
      rarity = "common"; xpBonus = 5; type = "fact";
      content = "A fascinating local secret about your neighborhood awaits!";
    } else if (roll < 0.88) {
      rarity = "rare"; xpBonus = 20; type = "insight";
      content = "Hidden gems nearby — explore the side streets for authentic local culture.";
    } else if (roll < 0.98) {
      rarity = "epic"; xpBonus = 50; type = "ai_story";
      content = "An epic discovery awaits! You've uncovered something special in this area.";
    } else {
      rarity = "legendary"; xpBonus = 150; type = "custom_guide";
      content = "Legendary find! You've become a true local expert of this district.";
    }

    this.applyXP(xpBonus);

    return {
      id: `box_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      rarity,
      earnedAt: new Date(),
      opened: false,
      reward: { type, content },
    };
  }

  /* ---------- STORAGE ---------- */

  private loadProgress(): void {
    const stored = localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!stored) {
      this.progress = this.createNewProgress();
      return;
    }
    this.progress = JSON.parse(stored, (_key, value) => {
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
        return new Date(value);
      }
      return value;
    });
  }

  private createNewProgress(): UserProgress {
    return {
      passport: {
        userId: "local_user",
        stamps: [],
        badges: [],
        statistics: {
          citiesVisited: 0,
          neighborhoodsExplored: 0,
          poisVisited: 0,
          countriesExplored: 0,
          routesCompleted: 0,
          questsCompleted: 0,
          longestRoute: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActiveDate: new Date(0),
        },
        level: {
          level: 1,
          title: "Tourist",
          xp: 0,
          xpToNextLevel: 100,
          cityLevels: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      activeQuests: [],
      completedQuests: [],
      achievements: [],
      mysteryBoxes: [],
      preferences: {
        enableViktor: true,
        enableNotifications: true,
        enableSounds: true,
        privacyMode: false,
      },
    };
  }

  private loadVisitedPOIs(): void {
    const stored = localStorage.getItem(STORAGE_KEY_VISITED_POIS);
    if (stored) this.visitedPOIs = new Set(JSON.parse(stored));
  }

  private loadTripHistory(): void {
    const stored = localStorage.getItem(STORAGE_KEY_TRIP_HISTORY);
    if (stored) {
      const parsed: TripMemory[] = JSON.parse(stored);
      this.tripHistory = parsed.map(t => ({ ...t, date: new Date(t.date) }));
    }
  }

  private saveProgress(): void {
    if (this.progress && typeof window !== "undefined") {
      this.progress.passport.updatedAt = new Date();
      localStorage.setItem(
        STORAGE_KEY_PROGRESS,
        JSON.stringify(this.progress)
      );
    }
  }
}

/* ============================================
   HELPERS
============================================ */

function getEndOfDay(): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

/* ============================================
   EXPORT SINGLETON
============================================ */

export const gamificationService = new GamificationService();
