import { Router, Request, Response } from "express";
import { getAnalyticsStats } from "../services/analytics";
import { checkAdminAuth } from "../middleware/adminAuth";

const router = Router();

// GET /analytics/stats
router.get("/stats", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const stats = await getAnalyticsStats();
    res.json(stats);
  } catch (err) {
    console.error("[Analytics] Stats error:", err);
    res.status(500).json({ error: "Failed to retrieve analytics stats." });
  }
});

export default router;
