const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api";

export interface CityInsights {
  overview: string;
  highlights: string[];
  historicalFact: string;
  localTip: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `API error: ${response.status}`);
  }

  if (response.status === 204) return {} as T;

  return response.json();
}

// AI endpoints (proxied through backend to NVIDIA NIM)
export const aiApi = {
  async getRecommendations(
    selectedPois: { name: string; category: string; address: string }[],
    userPreferences?: string,
    mood?: string
  ): Promise<{ recommendations: { name: string; category: string; reason: string }[] }> {
    return request("/ai/recommendations", {
      method: "POST",
      body: JSON.stringify({ selectedPois, userPreferences, mood }),
    });
  },

  async getTravelTips(poi: { name: string; category: string; address: string }): Promise<{
    description: string;
    tips: string[];
    localInsights: string;
  }> {
    return request("/ai/travel-tips", {
      method: "POST",
      body: JSON.stringify({ poi }),
    });
  },

  async getCityInsights(cityName: string): Promise<CityInsights> {
    return request("/ai/city-insights", {
      method: "POST",
      body: JSON.stringify({ cityName }),
    });
  },

  async getCitySummary(
    cityName: string,
    neighborhoodsVisited: string[],
    poisVisited: number
  ): Promise<{ summary: string }> {
    return request("/ai/city-summary", {
      method: "POST",
      body: JSON.stringify({ cityName, neighborhoodsVisited, poisVisited }),
    });
  },
};

export const feedbackApi = {
  async getStarStatus(): Promise<{ total: number; starred: boolean }> {
    return request("/feedback/star");
  },

  async toggleStar(): Promise<{ total: number; starred: boolean }> {
    return request("/feedback/star", { method: "POST" });
  },

  async submitBug(message: string): Promise<{ success: boolean; id: string }> {
    return request("/feedback/bug", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },
};
