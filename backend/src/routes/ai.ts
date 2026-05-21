import { Router, Response, Request } from "express";
import { generateRecommendations, generateTravelTips, generateNeighborhoodFact, generateCitySummary, generateHistoricalContext, generateCityInsights } from "../services/nim";
import { getCache, setCache, CACHE_TTL, CacheKeys } from "../services/cache";

const router = Router();

// POST /ai/recommendations — no auth required, with caching
router.post("/recommendations", async (req: Request, res: Response) => {
  try {
    const { selectedPois, userPreferences, mood } = req.body;

    if (!Array.isArray(selectedPois) || selectedPois.length === 0) {
      res.status(400).json({ error: "selectedPois array with at least one item is required." });
      return;
    }

    // Generate cache key from POIs, preferences, and mood
    const cacheKey = CacheKeys.aiRecommendations(
      JSON.stringify(selectedPois),
      `${userPreferences || ''}:${mood || ''}`
    );

    // Check cache
    const cachedRecs = await getCache(cacheKey);
    if (cachedRecs) {
      console.log('[CACHE HIT] AI recommendations');
      return res.json({ recommendations: cachedRecs, cached: true });
    }

    console.log('[CACHE MISS] AI recommendations - generating');
    const recommendations = await generateRecommendations(selectedPois, userPreferences, mood);

    // Cache the recommendations
    await setCache(cacheKey, recommendations, CACHE_TTL.AI_RECOMMENDATIONS);

    res.json({ recommendations, cached: false });
  } catch (err) {
    console.error("[AI] Recommendations error:", err);
    const message = err instanceof Error ? err.message : "AI service error.";
    res.status(503).json({ error: `AI service unavailable: ${message}. Check your NVIDIA_API_KEY.` });
  }
});

// POST /ai/travel-tips — no auth required, with caching
router.post("/travel-tips", async (req: Request, res: Response) => {
  try {
    const { poi } = req.body;

    if (!poi || !poi.name) {
      res.status(400).json({ error: "POI object with name is required." });
      return;
    }

    // Generate cache key
    const cacheKey = CacheKeys.aiTips(poi.name, poi.category || 'attraction', poi.address || '');

    // Check cache
    const cachedTips = await getCache(cacheKey);
    if (cachedTips) {
      console.log('[CACHE HIT] AI travel tips');
      return res.json({ ...cachedTips, cached: true });
    }

    console.log('[CACHE MISS] AI travel tips - generating');
    const tips = await generateTravelTips(poi);

    // Cache the tips
    await setCache(cacheKey, tips, CACHE_TTL.AI_TIPS);

    res.json({ ...tips, cached: false });
  } catch (err) {
    console.error("[AI] Travel tips error:", err);
    const message = err instanceof Error ? err.message : "AI service error.";
    res.status(503).json({ error: `AI service unavailable: ${message}. Check your NVIDIA_API_KEY.` });
  }
});

/**
 * POST /ai/neighborhood-fact
 * Generate a unique fact about a neighborhood for stamp collection (with caching)
 */
router.post("/neighborhood-fact", async (req: Request, res: Response) => {
  try {
    const { neighborhood, city } = req.body;

    if (!neighborhood || !city) {
      return res.status(400).json({
        error: "Missing required fields: neighborhood and city"
      });
    }

    // Generate cache key
    const cacheKey = CacheKeys.aiNeighborhoodFact(neighborhood, city);

    // Check cache first - neighborhood facts are stable
    const cachedFact = await getCache<string>(cacheKey);
    if (cachedFact) {
      console.log('[CACHE HIT] AI neighborhood fact');
      return res.json({
        fact: cachedFact,
        neighborhood,
        city,
        generatedAt: new Date().toISOString(),
        cached: true
      });
    }

    console.log('[CACHE MISS] AI neighborhood fact - generating');
    const fact = await generateNeighborhoodFact(neighborhood, city);

    // Cache for 7 days since neighborhood facts don't change
    await setCache(cacheKey, fact, CACHE_TTL.AI_NEIGHBORHOOD);

    res.json({
      fact,
      neighborhood,
      city,
      generatedAt: new Date().toISOString(),
      cached: false
    });
  } catch (error) {
    console.error("Error generating neighborhood fact:", error);
    res.status(500).json({
      error: "Failed to generate neighborhood fact",
      fallback: `${req.body.neighborhood} is a vibrant area in ${req.body.city} with unique character.`
    });
  }
});

/**
 * POST /ai/city-summary
 * Generate a personalized city exploration summary
 */
router.post("/city-summary", async (req: Request, res: Response) => {
  try {
    const { cityName, neighborhoodsVisited, poisVisited } = req.body;

    if (!cityName || !Array.isArray(neighborhoodsVisited) || typeof poisVisited !== 'number') {
      return res.status(400).json({
        error: "Missing required fields: cityName, neighborhoodsVisited (array), poisVisited (number)"
      });
    }

    const cacheKey = CacheKeys.aiCitySummary(cityName, neighborhoodsVisited);
    const cachedSummary = await getCache<string>(cacheKey);
    if (cachedSummary) {
      console.log('[CACHE HIT] AI city summary');
      return res.json({ summary: cachedSummary, cityName, neighborhoodsVisited: neighborhoodsVisited.length, poisVisited, generatedAt: new Date().toISOString(), cached: true });
    }

    console.log('[CACHE MISS] AI city summary - generating');
    const summary = await generateCitySummary(cityName, neighborhoodsVisited, poisVisited);
    await setCache(cacheKey, summary, CACHE_TTL.AI_CITY_SUMMARY);

    res.json({
      summary,
      cityName,
      neighborhoodsVisited: neighborhoodsVisited.length,
      poisVisited,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Error generating city summary:", error);
    res.status(500).json({
      error: "Failed to generate city summary",
      fallback: `You've explored ${req.body.neighborhoodsVisited?.length || 0} neighborhoods in ${req.body.cityName}!`
    });
  }
});

/**
 * POST /ai/historical-context
 * Generate historical context for a POI
 */
router.post("/historical-context", async (req: Request, res: Response) => {
  try {
    const { name, category, address } = req.body;

    if (!name || !category || !address) {
      return res.status(400).json({
        error: "Missing required fields: name, category, address"
      });
    }

    const cacheKey = CacheKeys.aiHistoricalContext(name, category, address);
    const cachedContext = await getCache<string>(cacheKey);
    if (cachedContext) {
      console.log('[CACHE HIT] AI historical context');
      return res.json({ context: cachedContext, poi: { name, category, address }, generatedAt: new Date().toISOString(), cached: true });
    }

    console.log('[CACHE MISS] AI historical context - generating');
    const context = await generateHistoricalContext({ name, category, address });
    await setCache(cacheKey, context, CACHE_TTL.AI_HISTORICAL);

    res.json({
      context,
      poi: { name, category, address },
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Error generating historical context:", error);
    res.status(500).json({
      error: "Failed to generate historical context",
      fallback: `${req.body.name} is a notable ${req.body.category} in this area.`
    });
  }
});

/**
 * POST /ai/city-insights
 * Generate rich travel insights for a city (cached 7 days, pre-warmed by cron)
 */
router.post("/city-insights", async (req: Request, res: Response) => {
  try {
    const { cityName } = req.body;

    if (!cityName || typeof cityName !== "string" || !cityName.trim()) {
      res.status(400).json({ error: "cityName (string) is required." });
      return;
    }

    const cacheKey = CacheKeys.aiCityInsights(cityName);
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`[CACHE HIT] AI city insights: ${cityName}`);
      return res.json({ ...cached, cached: true });
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

export default router;