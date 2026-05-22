import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

// Use @upstash/redis (HTTP) when UPSTASH_REDIS_REST_URL is set (production/serverless),
// otherwise use ioredis with a local Redis server.
const useUpstash = !!process.env.UPSTASH_REDIS_REST_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any;

if (useUpstash) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  const IoRedis = require('ioredis');
  redis = new IoRedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    enableReadyCheck: true,
    enableOfflineQueue: true,
  });
  redis.on('error', (err: Error) => console.error('❌ Redis error:', err.message));
  redis.on('connect', () => console.log('✅ Redis connected'));
}

export const CACHE_TTL = {
  OVERPASS: 3600,           // 1 hour
  NOMINATIM: 86400,         // 24 hours
  AI_NEIGHBORHOOD: 604800,  // 7 days
  AI_TIPS: 3600,            // 1 hour
  AI_RECOMMENDATIONS: 1800, // 30 minutes
  AI_CITY_SUMMARY: 3600,    // 1 hour
  AI_HISTORICAL: 604800,    // 7 days
  AI_CITY_INSIGHTS: 604800, // 7 days
};

function getCacheKey(prefix: string, ...parts: string[]): string {
  return `wandrmark:${prefix}:${parts.join(':')}`;
}

export function getGridCacheKey(
  lat: number,
  lng: number,
  radius: number,
  categories: string[]
): string {
  const metersPerDegree = 111_000;
  const gridSize = radius / metersPerDegree;
  const gridLat = Math.floor(lat / gridSize) * gridSize;
  const gridLng = Math.floor(lng / gridSize) * gridSize;
  const sortedCategories = [...categories].sort().join('-');
  return `wandrmark:overpass:grid:${gridLat.toFixed(5)}:${gridLng.toFixed(5)}:${radius}:${sortedCategories}`;
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (data === null || data === undefined) return null;
    // ioredis returns raw strings; @upstash/redis auto-parses JSON
    return useUpstash ? (data as T) : (JSON.parse(data) as T);
  } catch (err) {
    console.error(`Cache get error for key ${key}:`, err);
    return null;
  }
}

export async function setCache(
  key: string,
  data: unknown,
  ttl: number = CACHE_TTL.OVERPASS
): Promise<boolean> {
  try {
    // ioredis requires a string; @upstash/redis handles objects directly
    const value = useUpstash ? data : JSON.stringify(data);
    await redis.setex(key, ttl, value);
    return true;
  } catch (err) {
    console.error(`Cache set error for key ${key}:`, err);
    return false;
  }
}

export async function deleteCache(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.error(`Cache delete error for key ${key}:`, err);
    return false;
  }
}

export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch (err) {
    console.error(`Cache pattern delete error for ${pattern}:`, err);
    return 0;
  }
}

export const CacheKeys = {
  overpass: (query: string) =>
    getCacheKey("overpass", crypto.createHash("sha256").update(query).digest("hex").substring(0, 32)),
  nominatim: (type: "search" | "reverse", params: string) => getCacheKey("nominatim", type, params),
  aiNeighborhoodFact: (neighborhood: string, city: string) =>
    getCacheKey("ai", "neighborhood", city.toLowerCase(), neighborhood.toLowerCase()),
  aiTips: (poiName: string, category: string, address: string) =>
    getCacheKey("ai", "tips", category, poiName.toLowerCase().substring(0, 30), address.toLowerCase().substring(0, 40)),
  aiRecommendations: (selectedPois: string, preferences: string) =>
    getCacheKey("ai", "recs", crypto.createHash("sha256").update(selectedPois + preferences).digest("hex").substring(0, 32)),
  aiCitySummary: (cityName: string, neighborhoods: string[]) =>
    getCacheKey("ai", "city", cityName.toLowerCase(), [...neighborhoods].sort().join("-").substring(0, 50)),
  aiHistoricalContext: (name: string, category: string, address: string) =>
    getCacheKey("ai", "historical", category, name.toLowerCase().substring(0, 40), address.toLowerCase().substring(0, 40)),
  aiCityInsights: (cityName: string) =>
    getCacheKey("ai", "city-insights", cityName.split(",")[0].toLowerCase().trim()),
};

export async function acquireLock(key: string, ttlSeconds = 30): Promise<boolean> {
  try {
    const lockKey = `${key}:lock`;
    const result = useUpstash
      ? await redis.set(lockKey, '1', { ex: ttlSeconds, nx: true })
      : await redis.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    return false;
  }
}

export async function releaseLock(key: string): Promise<void> {
  try {
    await redis.del(`${key}:lock`);
  } catch {}
}

export async function trackMiss(cacheKey: string): Promise<void> {
  try {
    const missKey = `wandrmark:miss:${cacheKey}`;
    await redis.incr(missKey);
    await redis.expire(missKey, 30 * 24 * 3600);
  } catch {}
}

export async function getMissCount(cacheKey: string): Promise<number> {
  try {
    const val = await redis.get(`wandrmark:miss:${cacheKey}`);
    return val !== null ? Number(val) : 0;
  } catch {
    return 0;
  }
}

export async function getCacheTTL(key: string): Promise<number> {
  try {
    return await redis.ttl(key);
  } catch {
    return -2;
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export default redis;
