import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client with retry strategy
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
  enableReadyCheck: true,
  enableOfflineQueue: true,
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redis.on('ready', () => {
  console.log('✅ Redis ready');
});

redis.on('reconnecting', () => {
  console.log('⚠️  Redis reconnecting...');
});

/**
 * Cache TTL constants (in seconds)
 */
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

/**
 * Generate cache key with prefix
 */
function getCacheKey(prefix: string, ...parts: string[]): string {
  return `wandrmark:${prefix}:${parts.join(':')}`;
}

/**
 * Generate geographic grid-based cache key for POI queries
 * This ensures that nearby requests share the same cache entry
 * regardless of small coordinate differences
 */
export function getGridCacheKey(
  lat: number,
  lng: number,
  radius: number,
  categories: string[]
): string {
  // 1 degree latitude ~ 111 km
  const metersPerDegree = 111_000;
  const gridSize = radius / metersPerDegree; // grid cell size in degrees

  const gridLat = Math.floor(lat / gridSize) * gridSize;
  const gridLng = Math.floor(lng / gridSize) * gridSize;

  const sortedCategories = [...categories].sort().join('-');

  return `wandrmark:overpass:grid:${gridLat.toFixed(5)}:${gridLng.toFixed(5)}:${radius}:${sortedCategories}`;
}


/**
 * Get cached data
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`Cache get error for key ${key}:`, err);
    return null;
  }
}

/**
 * Set cached data with TTL
 */
export async function setCache(
  key: string,
  data: any,
  ttl: number = CACHE_TTL.OVERPASS
): Promise<boolean> {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`Cache set error for key ${key}:`, err);
    return false;
  }
}

/**
 * Delete cached data
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.error(`Cache delete error for key ${key}:`, err);
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
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
  overpass: (query: string) => getCacheKey("overpass", Buffer.from(query).toString("base64").substring(0, 50)),
  nominatim: (type: "search" | "reverse", params: string) => getCacheKey("nominatim", type, params),
  aiNeighborhoodFact: (neighborhood: string, city: string) =>
    getCacheKey("ai", "neighborhood", city.toLowerCase(), neighborhood.toLowerCase()),
  aiTips: (poiName: string, category: string, address: string) =>
    getCacheKey("ai", "tips", category, poiName.toLowerCase().substring(0, 30), address.toLowerCase().substring(0, 40)),
  aiRecommendations: (selectedPois: string, preferences: string) =>
    getCacheKey("ai", "recs", Buffer.from(selectedPois + preferences).toString("base64").substring(0, 50)),
  aiCitySummary: (cityName: string, neighborhoods: string[]) =>
    getCacheKey("ai", "city", cityName.toLowerCase(), [...neighborhoods].sort().join("-").substring(0, 50)),
  aiHistoricalContext: (name: string, category: string, address: string) =>
    getCacheKey("ai", "historical", category, name.toLowerCase().substring(0, 40), address.toLowerCase().substring(0, 40)),
  aiCityInsights: (cityName: string) =>
    getCacheKey("ai", "city-insights", cityName.split(",")[0].toLowerCase().trim()),
};

/**
 * Acquire a Redis lock (SET NX). Returns true if the lock was granted.
 * Used to prevent cache stampedes: only the first request fetches; others wait.
 */
export async function acquireLock(key: string, ttlSeconds = 30): Promise<boolean> {
  try {
    const result = await redis.set(`${key}:lock`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch {
    return false;
  }
}

/**
 * Release a previously acquired lock.
 */
export async function releaseLock(key: string): Promise<void> {
  try {
    await redis.del(`${key}:lock`);
  } catch {}
}

/**
 * Increment the miss counter for a cache key.
 * Counter expires after 30 days so unused keys don't accumulate.
 */
export async function trackMiss(cacheKey: string): Promise<void> {
  try {
    const missKey = `wandrmark:miss:${cacheKey}`;
    await redis.incr(missKey);
    await redis.expire(missKey, 30 * 24 * 3600);
  } catch {}
}

/**
 * Return the miss count for a cache key (0 if not tracked yet).
 */
export async function getMissCount(cacheKey: string): Promise<number> {
  try {
    const val = await redis.get(`wandrmark:miss:${cacheKey}`);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Return the remaining TTL in seconds for a key.
 * Redis returns -1 (no expiry) or -2 (key not found).
 */
export async function getCacheTTL(key: string): Promise<number> {
  try {
    return await redis.ttl(key);
  } catch {
    return -2;
  }
}

/**
 * Health check
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export default redis;
