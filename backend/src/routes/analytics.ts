import { Router, Request, Response } from "express";
import { getAnalyticsStats } from "../services/analytics";

const router = Router();

// GET /analytics/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await getAnalyticsStats();
    res.json(stats);
  } catch (err) {
    console.error("[Analytics] Stats error:", err);
    res.status(500).json({ error: "Failed to retrieve analytics stats." });
  }
});

export default router;
