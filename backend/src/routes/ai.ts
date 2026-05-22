import { Router, Response, Request } from "express";
import { z } from "zod";
import { generateRecommendations, generateTravelTips, generateNeighborhoodFact, generateCitySummary, generateHistoricalContext, generateCityInsights } from "../services/nim";
import { getCache, setCache, CACHE_TTL, CacheKeys } from "../services/cache";
import { getNimUsage } from "../services/nimUsage";
import { trackCityInsight } from "../services/analytics";

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const POIItemSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(50).optional().default("attraction"),
  address: z.string().max(500).optional().default(""),
});

const RecommendationsSchema = z.object({
  selectedPois: z.array(POIItemSchema).min(1).max(20),
  userPreferences: z.string().max(500).optional(),
  mood: z.string().max(50).optional(),
});

const TravelTipsSchema = z.object({
  poi: z.object({
    name: z.string().min(1).max(200),
    category: z.string().max(50).optional().default("attraction"),
    address: z.string().max(500).optional().default(""),
  }),
});

const NeighborhoodFactSchema = z.object({
  neighborhood: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
});

const CitySummarySchema = z.object({
  cityName: z.string().min(1).max(100),
  neighborhoodsVisited: z.array(z.string().max(100)).max(50),
  poisVisited: z.number().int().min(0).max(10000),
});

const HistoricalContextSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  address: z.string().min(1).max(500),
});

const CityInsightsSchema = z.object({
  cityName: z.string().min(1).max(100),
});

function validationError(res: Response, err: z.ZodError): void {
  res.status(400).json({ error: "Invalid request", details: err.issues.map(i => i.message) });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /ai/recommendations
router.post("/recommendations", async (req: Request, res: Response) => {
  const parsed = RecommendationsSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const { selectedPois, userPreferences, mood } = parsed.data;
  try {
    const cacheKey = CacheKeys.aiRecommendations(
      JSON.stringify(selectedPois),
      `${userPreferences || ''}:${mood || ''}`
    );
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log('[CACHE HIT] AI recommendations');
      return res.json({ recommendations: cached, cached: true });
    }

    console.log('[CACHE MISS] AI recommendations - generating');
    const recommendations = await generateRecommendations(
      selectedPois as { name: string; category: string; address: string }[],
      userPreferences,
      mood
    );
    await setCache(cacheKey, recommendations, CACHE_TTL.AI_RECOMMENDATIONS);
    res.json({ recommendations, cached: false });
  } catch (err) {
    console.error("[AI] Recommendations error:", err);
    const message = err instanceof Error ? err.message : "AI service error.";
    res.status(503).json({ error: `AI service unavailable: ${message}. Check your NVIDIA_API_KEY.` });
  }
});

// POST /ai/travel-tips
router.post("/travel-tips", async (req: Request, res: Response) => {
  const parsed = TravelTipsSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const { poi } = parsed.data;
  try {
    const cacheKey = CacheKeys.aiTips(poi.name, poi.category, poi.address);
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log('[CACHE HIT] AI travel tips');
      return res.json({ ...cached as object, cached: true });
    }

    console.log('[CACHE MISS] AI travel tips - generating');
    const tips = await generateTravelTips(poi as { name: string; category: string; address: string });
    await setCache(cacheKey, tips, CACHE_TTL.AI_TIPS);
    res.json({ ...tips, cached: false });
  } catch (err) {
    console.error("[AI] Travel tips error:", err);
    const message = err instanceof Error ? err.message : "AI service error.";
    res.status(503).json({ error: `AI service unavailable: ${message}. Check your NVIDIA_API_KEY.` });
  }
});

// POST /ai/neighborhood-fact
router.post("/neighborhood-fact", async (req: Request, res: Response) => {
  const parsed = NeighborhoodFactSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const { neighborhood, city } = parsed.data;
  try {
    const cacheKey = CacheKeys.aiNeighborhoodFact(neighborhood, city);
    const cached = await getCache<string>(cacheKey);
    if (cached) {
      console.log('[CACHE HIT] AI neighborhood fact');
      return res.json({ fact: cached, neighborhood, city, generatedAt: new Date().toISOString(), cached: true });
    }

    console.log('[CACHE MISS] AI neighborhood fact - generating');
    const fact = await generateNeighborhoodFact(neighborhood, city);
    await setCache(cacheKey, fact, CACHE_TTL.AI_NEIGHBORHOOD);
    res.json({ fact, neighborhood, city, generatedAt: new Date().toISOString(), cached: false });
  } catch (err) {
    console.error("Error generating neighborhood fact:", err);
    res.status(500).json({
      error: "Failed to generate neighborhood fact",
      fallback: `${neighborhood} is a vibrant area in ${city} with unique character.`,
    });
  }
});

// POST /ai/city-summary
router.post("/city-summary", async (req: Request, res: Response) => {
  const parsed = CitySummarySchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const { cityName, neighborhoodsVisited, poisVisited } = parsed.data;
  try {
    const cacheKey = CacheKeys.aiCitySummary(cityName, neighborhoodsVisited);
    const cached = await getCache<string>(cacheKey);
    if (cached) {
      console.log('[CACHE HIT] AI city summary');
      return res.json({ summary: cached, cityName, neighborhoodsVisited: neighborhoodsVisited.length, poisVisited, generatedAt: new Date().toISOString(), cached: true });
    }

    console.log('[CACHE MISS] AI city summary - generating');
    const summary = await generateCitySummary(cityName, neighborhoodsVisited, poisVisited);
    await setCache(cacheKey, summary, CACHE_TTL.AI_CITY_SUMMARY);
    res.json({ summary, cityName, neighborhoodsVisited: neighborhoodsVisited.length, poisVisited, generatedAt: new Date().toISOString(), cached: false });
  } catch (err) {
    console.error("Error generating city summary:", err);
    res.status(500).json({
      error: "Failed to generate city summary",
      fallback: `You've explored ${neighborhoodsVisited.length} neighborhoods in ${cityName}!`,
    });
  }
});

// POST /ai/historical-context
router.post("/historical-context", async (req: Request, res: Response) => {
  const parsed = HistoricalContextSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const { name, category, address } = parsed.data;
  try {
    const cacheKey = CacheKeys.aiHistoricalContext(name, category, address);
    const cached = await getCache<string>(cacheKey);
    if (cached) {
      console.log('[CACHE HIT] AI historical context');
      return res.json({ context: cached, poi: { name, category, address }, generatedAt: new Date().toISOString(), cached: true });
    }

    console.log('[CACHE MISS] AI historical context - generating');
    const context = await generateHistoricalContext({ name, category, address });
    await setCache(cacheKey, context, CACHE_TTL.AI_HISTORICAL);
    res.json({ context, poi: { name, category, address }, generatedAt: new Date().toISOString(), cached: false });
  } catch (err) {
    console.error("Error generating historical context:", err);
    res.status(500).json({
      error: "Failed to generate historical context",
      fallback: `${name} is a notable ${category} in this area.`,
    });
  }
});

// POST /ai/city-insights
router.post("/city-insights", async (req: Request, res: Response) => {
  const parsed = CityInsightsSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const { cityName } = parsed.data;
  trackCityInsight(cityName).catch(() => {});
  try {
    const cacheKey = CacheKeys.aiCityInsights(cityName);
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`[CACHE HIT] AI city insights: ${cityName}`);
      return res.json({ ...cached as object, cached: true });
    }

    console.log(`[CACHE MISS] AI city insights - generating: ${cityName}`);
    const insights = await generateCityInsights(cityName.split(",")[0].trim());
    await setCache(cacheKey, insights, CACHE_TTL.AI_CITY_INSIGHTS);
    res.json({ ...insights, cached: false });
  } catch (err) {
    console.error("[AI] City insights error:", err);
    const message = err instanceof Error ? err.message : "AI service error.";
    res.status(503).json({ error: `AI service unavailable: ${message}. Check your NVIDIA_API_KEY.` });
  }
});

// GET /ai/usage
router.get("/usage", async (_req: Request, res: Response) => {
  try {
    const stats = await getNimUsage();
    res.json(stats);
  } catch (err) {
    console.error("[AI] Usage stats error:", err);
    res.status(500).json({ error: "Failed to retrieve NIM usage stats" });
  }
});

export default router;
