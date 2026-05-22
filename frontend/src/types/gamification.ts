// Gamification type definitions
import type { LatLng, POI, POICategory, RouteSegment } from "./index";

export interface ExplorerPassport {
  userId: string;
  stamps: Stamp[];
  badges: Badge[];
  statistics: PassportStatistics;
  level: ExplorerLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stamp {
  id: string;
  neighborhoodName: string;
  cityName: string;
  countryCode: string;
  coordinates: LatLng;
  earnedAt: Date;
  uniquePOIsVisited: number;
  rarity: 'common' | 'rare' | 'legendary';
  aiDescription?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  iconEmoji: string;
  earnedAt: Date;
  rarity: 'bronze' | 'silver' | 'gold' | 'platinum';
  progress?: {
    current: number;
    target: number;
  };
}

export type BadgeCategory =
  | 'pois'
  | 'speed'
  | 'streak'
  | 'special'
  | 'category'
  | 'social'
  | 'seasonal';

export interface PassportStatistics {
  citiesVisited: number;
  neighborhoodsExplored: number;
  poisVisited: number;
  countriesExplored: number;
  routesCompleted: number;
  questsCompleted: number;
  longestRoute: number; // meters
  favoriteCategory?: POICategory;
  currentStreak: number; // days
  longestStreak: number; // days
  lastActiveDate: Date;
}

export interface ExplorerLevel {
  level: number;
  title: ExplorerTitle;
  xp: number;
  xpToNextLevel: number;
  cityLevels: CityLevel[];
}

export type ExplorerTitle =
  | 'Tourist'
  | 'Traveler'
  | 'Explorer'
  | 'Local Guide'
  | 'City Expert'
  | 'Legend';

export interface CityLevel {
  cityName: string;
  poisVisited: number;
  level: ExplorerTitle;
  unlockedPerks: string[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  difficulty: 'easy' | 'medium' | 'hard' | 'epic';
  requirements: QuestRequirement[];
  reward: QuestReward;
  progress: number; // 0-100
  isActive: boolean;
  isCompleted: boolean;
  expiresAt?: Date;
  aiGenerated: boolean;
  cityName?: string;
}

export type QuestType =
  | 'discovery'
  | 'theme'
  | 'time'
  | 'category'
  | 'ai_generated'
  | 'seasonal';

export interface QuestRequirement {
  id: string;
  type:
    | 'visit_pois'
    | 'visit_categories'
    | 'time_window'
    | 'specific_location'
    | 'complete_route';
  target: number;
  current: number;
  details: any;
  description: string;
}

export interface QuestReward {
  xp: number;
  badge?: Badge;
  unlockFeature?: string;
  mysteryBox?: boolean;
  aiStory?: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  iconEmoji: string;
  requirement: {
    type: string;
    target: number;
  };
  reward: {
    xp: number;
    badge?: Badge;
  };
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface MysteryBox {
  id: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  reward: MysteryBoxReward;
  earnedAt: Date;
  opened: boolean;
}

export interface MysteryBoxReward {
  type: 'fact' | 'insight' | 'feature_unlock' | 'ai_story' | 'custom_guide';
  content: string;
  duration?: number; // For temporary unlocks (days)
}

export interface HistoricalView {
  poiId: string;
  timeline: HistoricalPeriod[];
  generatedAt: Date;
}

export interface HistoricalPeriod {
  era: string;
  year: number;
  description: string;
  funFact?: string;
  notableEvent?: string;
  imageUrl?: string;
}

export interface RouteChallenge {
  id: string;
  creatorName?: string;
  cityName: string;
  countryCode: string;
  pois: POI[];
  route?: RouteSegment[];
  estimatedTime: number;
  totalDistance: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'epic';
  theme?: string;
  description?: string;
  createdAt: Date;
  completedBy?: number; // Count
}

export interface UserProgress {
  passport: ExplorerPassport;
  activeQuests: Quest[];
  completedQuests: Quest[];
  achievements: Achievement[];
  mysteryBoxes: MysteryBox[];
  preferences: {
    enableViktor: boolean;
    enableNotifications: boolean;
    enableSounds: boolean;
    privacyMode: boolean;
  };
}

// Mood-based discovery
export type MoodType =
  | 'contemplative'
  | 'energetic'
  | 'creative'
  | 'indulgent'
  | 'peaceful'
  | 'social'
  | 'intellectual'
  | 'adventurous';

export interface MoodProfile {
  mood: MoodType;
  emoji: string;
  label: string;
  description: string;
  preferredCategories: POICategory[];
  keywords: string[];
}

// Memory Lane
export interface TripMemory {
  id: string;
  date: Date;
  cityName: string;
  route?: RouteSegment[];
  poisVisited: POI[];
  distance: number;
  duration: number;
  photos?: string[]; // Local URIs only
  notes?: string;
  mood?: MoodType;
  weather?: string;
  achievements: Achievement[];
  questsCompleted: Quest[];
}

export interface YearInReview {
  year: number;
  statistics: {
    citiesExplored: number;
    poisVisited: number;
    achievementsUnlocked: number;
    questsCompleted: number;
    favoritCity: string;
    favoritePOI?: POI;
    biggestQuest?: Quest;
    topCategory: POICategory;
    memorableRoutes: TripMemory[];
  };
  generatedAt: Date;
}

// Re-export for convenience
export type { POI, POICategory, LatLng, RouteSegment };