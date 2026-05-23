import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import http from "http";
import { checkRedisHealth } from "./services/cache";
import { trackRequest } from "./services/usage";
import { isWhitelistedIP, checkAdminAuth } from "./middleware/adminAuth";
import aiRoutes from "./routes/ai";
import proxyRoutes from "./routes/proxy";
import cacheRoutes from "./routes/cache";
import feedbackRoutes from "./routes/feedback";
import analyticsRoutes from "./routes/analytics";
import swaggerRouter from "./swagger";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

if (IS_PROD && !process.env.NVIDIA_API_KEY) {
  console.error("❌ NVIDIA_API_KEY is required in production");
  process.exit(1);
}

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

// Trust the first proxy hop so req.ip reflects the real client IP behind nginx / a load balancer.
app.set("trust proxy", 1);

function getClientIP(req: express.Request): string {
  return (req.ip ?? req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser requests have no Origin header; the IP-whitelist middleware handles them.
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      console.warn(`🚫 Blocked CORS request from: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

// In production, enforce origin and IP rules server-side — not just via CORS headers.
// CORS alone is browser-enforced: the server still processes (and pays for) cross-origin
// requests even if the browser hides the response. We reject them here instead.
if (IS_PROD) {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin;

    if (origin) {
      // Browser request from a disallowed origin — refuse before doing any work.
      if (!ALLOWED_ORIGINS.includes(origin)) {
        console.warn(`🚫 Blocked cross-origin request from: ${origin}`);
        return res.status(403).json({ error: "Forbidden" });
      }
    } else {
      // No origin header — non-browser client. Must be a whitelisted IP.
      if (!isWhitelistedIP(req)) {
        console.warn(`🚫 Blocked non-browser request from ${getClientIP(req)}`);
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    next();
  });
}

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const proxyLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: "Too many API requests, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tight limit on AI routes — each call hits the NVIDIA API and costs money.
// 15 requests per 15 minutes per IP is generous for real use but stops abuse.
const aiLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || "900000"),
  max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || "15"),
  message: { error: "AI request limit reached. Please wait before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Usage tracking — fire-and-forget, never blocks the request
app.use("/api/", (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  trackRequest(getClientIP(req), req.method, req.path).catch(() => {});
  next();
});

app.use("/api/", apiLimiter);
app.use("/api/proxy/", proxyLimiter);
app.use("/api/ai/", aiLimiter);

app.use("/api/ai", aiRoutes);
app.use("/api/proxy", proxyRoutes);
app.use("/api/cache", cacheRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/docs", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!checkAdminAuth(req, res)) return;
  next();
}, swaggerRouter);

app.get("/api/health", async (_req, res) => {
  const redisHealth = await checkRedisHealth();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    services: {
      redis: redisHealth ? "connected" : "disconnected",
      nim: {
        baseUrl: process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1",
        model: process.env.NIM_MODEL || "meta/llama-3.1-8b-instruct",
        configured: !!process.env.NVIDIA_API_KEY,
      },
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR]", err.message);
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : err.message;
  res.status(500).json({ error: message });
});

let httpServer: http.Server | null = null;

const shutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down…`);
  if (httpServer) {
    httpServer.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
  setTimeout(() => process.exit(1), 10_000);
};

async function start() {
  console.log(`\n🚀 Wandrmark Backend starting on port ${PORT}…`);

  const redisHealth = await checkRedisHealth();
  console.log(redisHealth ? "✅ Redis connected." : "⚠️  Redis unavailable — caching disabled.");

  httpServer = app.listen(Number(PORT), () => {
    const nimKey = process.env.NVIDIA_API_KEY ? "configured" : "NOT SET — AI disabled";
    console.log(`✅ Server at http://localhost:${PORT}/api`);
    console.log(`   NIM: ${process.env.NIM_MODEL || "meta/llama-3.1-8b-instruct"} (${nimKey})`);
    console.log(`   Cache: warm via POST /api/cache/warm\n`);
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// In Vercel serverless the module is imported — only start the HTTP server when run directly.
if (require.main === module) {
  start();
}

export default app;
