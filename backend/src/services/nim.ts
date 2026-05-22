import dotenv from "dotenv";
dotenv.config();

const NIM_BASE_URL = process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
const NIM_MODEL = process.env.NIM_MODEL || "meta/llama-3.1-8b-instruct";
const NIM_API_KEY = process.env.NVIDIA_API_KEY || "";
const REQUEST_TIMEOUT_MS = Number(process.env.NIM_TIMEOUT_MS ?? 30000);

interface NIMChatResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

async function nimGenerate(prompt: string, systemPrompt?: string): Promise<string> {
  if (!NIM_API_KEY) {
    throw new Error("NVIDIA_API_KEY is not configured. Set it in your .env file.");
  }

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${NIM_API_KEY}`,
        },
        body: JSON.stringify({
          model: NIM_MODEL,
          messages,
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[NIM] API error ${response.status}:`, errText.substring(0, 300));
        throw new Error(`NIM API returned status ${response.status}.`);
      }

      const data = (await response.json()) as NIMChatResponse;
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Unknown error");
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError || new Error("NIM request failed after retries.");
}

export async function generateRecommendations(
  selectedPois: { name: string; category: string; address: string }[],
  userPreferences?: string,
  mood?: string
): Promise<{ name: string; category: string; reason: string }[]> {
  const poiList = selectedPois
    .map((p, i) => `${i + 1}. ${p.name} (${p.category}) — ${p.address}`)
    .join("\n");

  const systemPrompt = `You are a knowledgeable local travel assistant. Given a list of places a traveler plans to visit, suggest 3-5 additional places they might enjoy. Return ONLY a valid JSON array with no extra text. Each object must have: "name" (string), "category" (one of: restaurant, cafe, attraction, park, museum), "reason" (short explanation string).`;

  const moodLine = mood ? `\nThe traveler is feeling ${mood} today — tailor suggestions accordingly.` : "";
  const prompt = `The traveler is visiting these places:\n${poiList}\n${userPreferences ? `\nPreferences: ${userPreferences}` : ""}${moodLine}\n\nSuggest 3-5 complementary places they would enjoy nearby. Return only the JSON array.`;

  const raw = await nimGenerate(prompt, systemPrompt);

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [
      { name: "Local Market", category: "restaurant", reason: "A great stop to experience local food culture." },
      { name: "Riverside Walk", category: "park", reason: "A relaxing break between sightseeing stops." },
    ];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 5).map((item: Record<string, string>) => ({
        name: item.name || "Unknown Place",
        category: ["restaurant", "cafe", "attraction", "park", "museum"].includes(item.category)
          ? item.category
          : "attraction",
        reason: item.reason || "Recommended based on your travel profile.",
      }));
    }
  } catch {}

  return [
    { name: "Local Market", category: "restaurant", reason: "A great stop to experience local food culture." },
    { name: "Riverside Walk", category: "park", reason: "A relaxing break between sightseeing stops." },
  ];
}

export async function generateTravelTips(poi: {
  name: string;
  category: string;
  address: string;
}): Promise<{ description: string; tips: string[]; localInsights: string }> {
  const systemPrompt = `You are a local travel expert. Given a place name, category, and address, provide a short description, 2-4 practical travel tips, and a local insight. Return ONLY valid JSON with keys: "description" (string), "tips" (array of strings), "localInsights" (string). No extra text.`;

  const prompt = `Place: ${poi.name}\nCategory: ${poi.category}\nAddress: ${poi.address}\n\nProvide travel info as JSON.`;

  const raw = await nimGenerate(prompt, systemPrompt);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      description: `${poi.name} is a ${poi.category} located at ${poi.address}. A worthwhile stop on your journey.`,
      tips: ["Check opening hours before visiting.", "Bring cash as a backup."],
      localInsights: "Ask locals for their favorite nearby spots — they often know hidden gems.",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      description: parsed.description || `${poi.name} is a notable ${poi.category}.`,
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 4) : ["Arrive early for the best experience."],
      localInsights: parsed.localInsights || parsed.local_insights || "A local favorite worth exploring.",
    };
  } catch {}

  return {
    description: `${poi.name} is a ${poi.category} worth visiting.`,
    tips: ["Check opening hours.", "Bring cash as a backup."],
    localInsights: "Ask locals for hidden gem recommendations nearby.",
  };
}

export async function generateNeighborhoodFact(
  neighborhoodName: string,
  cityName: string
): Promise<string> {
  const systemPrompt = `You are a knowledgeable local historian and cultural expert.
Your task is to generate a single fascinating, unique fact about a neighborhood.
The fact should be:
- Interesting and engaging
- Historically or culturally significant
- Under 100 words
- Written in a conversational, enthusiastic tone
- Start with "Did you know?" or a similar engaging opener

Focus on history, architecture, culture, famous residents, unique characteristics, or interesting trivia.`;

  const prompt = `Generate a fascinating fact about the ${neighborhoodName} neighborhood in ${cityName}.
Make it memorable and specific to this location.`;

  try {
    const raw = await nimGenerate(prompt, systemPrompt);

    let fact = raw.trim();
    fact = fact.replace(/\*\*/g, "");
    fact = fact.replace(/\*/g, "");

    if (!fact.match(/^(Did you know|Fun fact|Interesting)/i)) {
      fact = `Did you know? ${fact}`;
    }

    if (fact.length > 250) {
      fact = fact.substring(0, 247) + "...";
    }

    return fact;
  } catch (error) {
    console.error("Error generating neighborhood fact:", error);
    return `Did you know? ${neighborhoodName} is a distinctive part of ${cityName}, known for its unique character and local charm. Each visit here reveals something new about the city's rich tapestry.`;
  }
}

export async function generateHistoricalContext(poi: {
  name: string;
  category: string;
  address: string;
}): Promise<string> {
  const systemPrompt = `You are a historian specializing in urban history and architecture.
Provide a brief historical context (2-3 sentences) about a location, focusing on its origins,
historical significance, or how it has evolved over time.`;

  const prompt = `Provide historical context for: ${poi.name} (${poi.category}) located at ${poi.address}.`;

  try {
    const raw = await nimGenerate(prompt, systemPrompt);
    return raw.trim();
  } catch (error) {
    console.error("Error generating historical context:", error);
    return `${poi.name} has been a notable ${poi.category} in this area, serving as a gathering place for locals and visitors alike.`;
  }
}

export interface CityInsights {
  overview: string;
  highlights: string[];
  historicalFact: string;
  localTip: string;
}

function fallbackCityInsights(cityName: string): CityInsights {
  return {
    overview: `${cityName} is a dynamic destination with a unique blend of culture, history, and modern attractions worth exploring.`,
    highlights: ["Historic landmarks", "Local cuisine", "Cultural museums", "Scenic parks"],
    historicalFact: `${cityName} has a rich history that has shaped the region's culture and identity over centuries.`,
    localTip: "Explore neighborhoods beyond the tourist center for authentic local experiences.",
  };
}

export async function generateCityInsights(cityName: string): Promise<CityInsights> {
  const systemPrompt = `You are an expert travel writer and historian. Given a city name, provide rich, engaging travel insights. Return ONLY valid JSON with no extra text. The JSON must have exactly these keys: "overview" (2-3 sentences about the city's character and significance), "highlights" (array of exactly 3-4 short strings, each naming a notable attraction or experience), "historicalFact" (1-2 sentences about an interesting historical event or fact specific to this city), "localTip" (1 sentence of insider advice for visitors).`;

  const prompt = `Provide travel insights for: ${cityName}. Return only the JSON object.`;

  const raw = await nimGenerate(prompt, systemPrompt);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallbackCityInsights(cityName);

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      overview: parsed.overview || fallbackCityInsights(cityName).overview,
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 4) : fallbackCityInsights(cityName).highlights,
      historicalFact: parsed.historicalFact || fallbackCityInsights(cityName).historicalFact,
      localTip: parsed.localTip || fallbackCityInsights(cityName).localTip,
    };
  } catch {
    return fallbackCityInsights(cityName);
  }
}

export async function generateCitySummary(
  cityName: string,
  neighborhoodsVisited: string[],
  poisVisited: number
): Promise<string> {
  const systemPrompt = `You are an enthusiastic travel writer. Create a personalized,
encouraging summary of someone's exploration of a city. Keep it upbeat and motivating,
2-3 sentences max.`;

  const neighborhoods = neighborhoodsVisited.slice(0, 5).join(", ");
  const prompt = `A traveler has visited ${poisVisited} places across ${neighborhoodsVisited.length} neighborhoods in ${cityName}, including ${neighborhoods}.
Write a brief, encouraging summary of their exploration journey.`;

  try {
    const raw = await nimGenerate(prompt, systemPrompt);
    return raw.trim();
  } catch (error) {
    console.error("Error generating city summary:", error);
    return `You've explored ${neighborhoodsVisited.length} neighborhoods in ${cityName}, discovering ${poisVisited} unique places. Your journey through this city is building an amazing collection of memories!`;
  }
}
