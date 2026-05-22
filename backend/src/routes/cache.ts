import { Router, Request, Response } from "express";
import { deleteCachePattern, checkRedisHealth } from "../services/cache";
import { warmGeocodingCache } from "../scripts/warmGeocoding";
import { warmMajorCities } from "../scripts/warmCache";

const router = Router();

function checkWarmSecret(req: Request, res: Response): boolean {
  const secret = process.env.CACHE_WARM_SECRET;
  if (!secret) return true; // not configured — allow (dev mode)
  const provided = req.headers["x-cache-secret"];
  if (provided !== secret) {
    res.status(401).json({ error: "Invalid or missing x-cache-secret header" });
    return false;
  }
  return true;
}

router.get("/health", async (_req: Request, res: Response) => {
  try {
    const healthy = await checkRedisHealth();
    if (healthy) {
      return res.json({ status: "healthy" });
    }
    return res.status(503).json({ status: "unhealthy" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.post("/warm", async (req: Request, res: Response) => {
  if (!checkWarmSecret(req, res)) return;

  try {
    const { mode = "top", cities, skipExisting = false } = req.body;
    const targetCities: string[] | undefined = Array.isArray(cities) ? cities : undefined;

    res.json({ status: "started", mode, message: "Cache warming started — check server logs." });

    const run = async () => {
      if (mode === "geocoding") {
        await warmGeocodingCache(targetCities);
      } else {
        await warmMajorCities(targetCities, { skipExisting, saveFailures: false });
      }
    };

    run().catch((err) => console.error("[CACHE WARM] Error:", err));
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.delete("/clear", async (req: Request, res: Response) => {
  if (!checkWarmSecret(req, res)) return;

  try {
    const { pattern } = req.query;
    const key = pattern && typeof pattern === "string" ? `wandrmark:${pattern}:*` : "wandrmark:*";
    const count = await deleteCachePattern(key);
    res.json({ success: true, deletedCount: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const { default: redis } = await import("../services/cache");
    const [overpass, nominatim, ai] = await Promise.all([
      (redis as any).keys("wandrmark:overpass:*"),
      (redis as any).keys("wandrmark:nominatim:*"),
      (redis as any).keys("wandrmark:ai:*"),
    ]);
    res.json({
      total: overpass.length + nominatim.length + ai.length,
      breakdown: { overpass: overpass.length, nominatim: nominatim.length, ai: ai.length },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

export default router;
