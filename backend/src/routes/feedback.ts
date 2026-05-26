import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { submitBug, getBugReports, toggleStar, getStarStatus, getFeedbackStats } from "../services/feedback";
import { checkAdminAuth } from "../middleware/adminAuth";

const router = Router();

function getClientIP(req: Request): string {
  return ((req.ip ?? req.socket.remoteAddress) || "").replace(/^::ffff:/, "");
}

const bugLimiter = rateLimit({
  windowMs: 3_600_000, // 1 hour
  max: 5,
  message: { error: "Too many bug reports. Please wait before submitting again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const starLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const BugSchema = z.object({
  message: z.string().min(10).max(1000).trim(),
});

// POST /feedback/bug — open (anyone can submit), tight rate limit
router.post("/bug", bugLimiter, async (req: Request, res: Response) => {
  const parsed = BugSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Message must be 10–1000 characters." });
  }
  try {
    const report = await submitBug(getClientIP(req), parsed.data.message);
    res.json({ success: true, id: report.id });
  } catch {
    res.status(500).json({ error: "Failed to submit bug report." });
  }
});

// GET /feedback/bugs — admin only (requires warm secret)
router.get("/bugs", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const reports = await getBugReports();
    res.json({ count: reports.length, reports });
  } catch {
    res.status(500).json({ error: "Failed to retrieve bug reports." });
  }
});

// POST /feedback/star — open, toggles for current IP
router.post("/star", starLimiter, async (req: Request, res: Response) => {
  try {
    const result = await toggleStar(getClientIP(req));
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to update star." });
  }
});

// GET /feedback/star — open, returns count + whether current IP starred
router.get("/star", async (req: Request, res: Response) => {
  try {
    const result = await getStarStatus(getClientIP(req));
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to get star status." });
  }
});

// GET /feedback/stats — open, aggregate counts (no full data fetch)
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await getFeedbackStats();
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Failed to get feedback stats." });
  }
});

export default router;
