import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import http from "http";
import { checkRedisHealth } from "./services/cache";
import aiRoutes from "./routes/ai";
import proxyRoutes from "./routes/proxy";
import cacheRoutes from "./routes/cache";
import { startCacheWarmer } from "./scheduler";
import swaggerRouter from "./swagger";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV === "production" && !process.env.NVIDIA_API_KEY) {
  console.error("❌ NVIDIA_API_KEY is required in production");
  process.exit(1);
}

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: (origin, callback) => {
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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api/", apiLimiter);
app.use("/api/proxy/", proxyLimiter);

app.use("/api/ai", aiRoutes);
app.use("/api/proxy", proxyRoutes);
app.use("/api/cache", cacheRoutes);
app.use("/api/docs", swaggerRouter);

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
  if (redisHealth) {
    console.log("✅ Redis connected.");
    startCacheWarmer();
  } else {
    console.warn("⚠️  Redis unavailable — caching disabled.");
  }

  httpServer = app.listen(Number(PORT), () => {
    const nimKey = process.env.NVIDIA_API_KEY ? "configured" : "NOT SET — AI disabled";
    console.log(`✅ Server at http://localhost:${PORT}/api`);
    console.log(`   NIM: ${process.env.NIM_MODEL || "meta/llama-3.1-8b-instruct"} (${nimKey})`);
    console.log(`   Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}\n`);
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();

export default app;
