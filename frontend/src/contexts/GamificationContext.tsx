"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { gamificationService } from "@/services/gamification";
import { UserProgress, Achievement, MysteryBox, Quest, TripMemory, MoodType } from "@/types/gamification";
import { POI, RouteSegment } from "@/types";

interface VisitResult {
  isNew: boolean;
  xpGained: number;
  leveledUp: boolean;
  newLevel?: string;
  achievements: Achievement[];
  mysteryBox?: MysteryBox;
  completedQuests: Quest[];
}

interface TripMemoryInput {
  cityName: string;
  poisVisited: POI[];
  route?: RouteSegment[];
  distance: number;
  duration: number;
  notes?: string;
  mood?: MoodType;
}

interface GamificationContextValue {
  progress: UserProgress | null;
  visitPOI: (poi: POI) => Promise<VisitResult>;
  refresh: () => void;
  visitedPoiIds: Set<string>;
  openMysteryBox: (id: string) => void;
  saveTripMemory: (data: TripMemoryInput) => void;
  tripHistory: TripMemory[];
}

const GamificationContext = createContext<GamificationContextValue>({
  progress: null,
  visitPOI: async () => ({ isNew: false, xpGained: 0, leveledUp: false, achievements: [], completedQuests: [] }),
  refresh: () => {},
  visitedPoiIds: new Set(),
  openMysteryBox: () => {},
  saveTripMemory: () => {},
  tripHistory: [],
});

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [visitedPoiIds, setVisitedPoiIds] = useState<Set<string>>(new Set());
  const [tripHistory, setTripHistory] = useState<TripMemory[]>([]);

  const refresh = useCallback(() => {
    setProgress(gamificationService.getProgress());
    setVisitedPoiIds(gamificationService.getVisitedPOIIds());
    setTripHistory(gamificationService.getTripHistory());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visitPOI = useCallback(async (poi: POI): Promise<VisitResult> => {
    const result = await gamificationService.visitPOI(poi);
    refresh();
    return result;
  }, [refresh]);

  const openMysteryBox = useCallback((id: string) => {
    gamificationService.openMysteryBox(id);
    setProgress(gamificationService.getProgress());
  }, []);

  const saveTripMemory = useCallback((data: TripMemoryInput) => {
    gamificationService.saveTripMemory(data);
    setTripHistory(gamificationService.getTripHistory());
  }, []);

  return (
    <GamificationContext.Provider value={{ progress, visitPOI, refresh, visitedPoiIds, openMysteryBox, saveTripMemory, tripHistory }}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  return useContext(GamificationContext);
}
