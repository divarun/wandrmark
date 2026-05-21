import { setCache, CACHE_TTL, getGridCacheKey, deleteCachePattern, getCache, getMissCount, CacheKeys } from '../services/cache';
import { getCachedCityCoordinates, warmGeocodingCache } from './warmGeocoding';
import { generateCityInsights } from '../services/nim';
import crypto from 'crypto';
import { CITIES } from '../data/cities';
import redis from '../services/cache';

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api';

// Categories to pre-fetch for each city
const CATEGORIES = ['restaurant', 'cafe', 'museum', 'park', 'attraction'] as const;
type POICategory = typeof CATEGORIES[number];

// Search radius in meters
const RADIUS = 1500;

// Delay between requests to avoid rate limiting (in ms)
const REQUEST_DELAY = 5000;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [10000, 30000, 60000]; // 10s, 30s, 60s

// Minimum TTL threshold - if cache has less than this, re-warm it
const MIN_TTL_THRESHOLD = 1800; // 30 minutes

// Delay between NIM AI calls (ms)
const AI_INSIGHTS_DELAY = 500;

// Track failures for retry
interface FailedCity {
  name: string;
  error: string;
  attempts: number;
}

const failedCities: FailedCity[] = [];

/**
 * Build optimized Overpass query for a city
 */
function buildQuery(
  lat: number,
  lng: number,
  radius: number,
  categories: readonly POICategory[]
): string {
  const queries: string[] = [];

  categories.forEach((category) => {
    switch (category) {
      case 'restaurant':
        queries.push(`node["amenity"="restaurant"](around:${radius},${lat},${lng});`);
        break;
      case 'cafe':
        queries.push(`node["amenity"="cafe"](around:${radius},${lat},${lng});`);
        break;
      case 'museum':
        queries.push(`node["tourism"="museum"](around:${radius},${lat},${lng});`);
        queries.push(`way["tourism"="museum"](around:${radius},${lat},${lng});`);
        break;
      case 'park':
        queries.push(`node["leisure"="park"](around:${radius},${lat},${lng});`);
        queries.push(`way["leisure"="park"](around:${radius},${lat},${lng});`);
        break;
      case 'attraction':
        queries.push(`node["tourism"="attraction"](around:${radius},${lat},${lng});`);
        queries.push(`node["tourism"="viewpoint"](around:${radius},${lat},${lng});`);
        break;
    }
  });

  return `
[out:json][timeout:25];
(
  ${queries.join('\n  ')}
);
out body center 60;
  `.trim();
}

/**
 * Fetch POI data from Overpass API with retry logic
 */
async function fetchFromOverpass(query: string, retryCount = 0): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${OVERPASS_URL}/interpreter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Wandrmark-CacheWarmer/2.0',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();

      // If 504 (timeout) or 429 (rate limit), retry
      if ((response.status === 504 || response.status === 429) && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || 60000;
        console.log(`⏳ Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchFromOverpass(query, retryCount + 1);
      }

      throw new Error(
        `Overpass API error ${response.status}: ${errorText.substring(0, 100)}`
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    // Retry on network errors
    if (retryCount < MAX_RETRIES && error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('fetch')) {
        const delay = RETRY_DELAYS[retryCount] || 60000;
        console.log(`⏳ Network error - Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchFromOverpass(query, retryCount + 1);
      }
    }

    throw error;
  }
}

/**
 * Fetch and cache POIs for a single grid cell.
 */
async function warmSingleCell(lat: number, lng: number, label: string, skipIfExists: boolean): Promise<boolean> {
  const cacheKey = getGridCacheKey(lat, lng, RADIUS, [...CATEGORIES]);

  if (skipIfExists) {
    const cached = await getCache(cacheKey);
    if (cached) {
      const ttl = await redis.ttl(cacheKey);
      if (ttl > MIN_TTL_THRESHOLD) {
        console.log(`  ⏭️  ${label} (${lat.toFixed(4)}, ${lng.toFixed(4)}): Already cached (TTL: ${Math.floor(ttl / 3600)}h), skipping`);
        return true;
      }
    }
  }

  const data = await fetchFromOverpass(buildQuery(lat, lng, RADIUS, CATEGORIES));

  if (!data.elements || data.elements.length === 0) {
    console.log(`  ⚠️  ${label} (${lat.toFixed(4)}, ${lng.toFixed(4)}): No POIs found`);
    return false;
  }

  await setCache(cacheKey, data, CACHE_TTL.OVERPASS * 14);
  console.log(`  ✅ ${label} (${lat.toFixed(4)}, ${lng.toFixed(4)}): ${data.elements.length} POIs cached`);
  return true;
}

/**
 * Check if city is already cached with sufficient TTL
 */
async function isCityCached(cityName: string): Promise<{ cached: boolean; ttl?: number }> {
  try {
    const coords = await getCachedCityCoordinates(cityName);
    if (!coords) {
      return { cached: false };
    }

    const cacheKey = getGridCacheKey(coords.lat, coords.lng, RADIUS, [...CATEGORIES]);

    // Check if key exists
    const cached = await getCache(cacheKey);
    if (!cached) {
      return { cached: false };
    }

    // Check TTL
    const ttl = await redis.ttl(cacheKey);

    // TTL -1 means no expiration (shouldn't happen with our setup)
    // TTL -2 means key doesn't exist
    // TTL > 0 means time remaining
    if (ttl === -2) {
      return { cached: false };
    }

    return { cached: true, ttl };
  } catch (error) {
    console.error(`Error checking cache for ${cityName}:`, error);
    return { cached: false };
  }
}

/**
 * Warm cache for a single city (center cell only).
 */
async function warmCityCache(cityName: string, skipIfExists = false): Promise<boolean> {
  try {
    if (skipIfExists) {
      const { cached, ttl } = await isCityCached(cityName);
      if (cached && ttl && ttl > MIN_TTL_THRESHOLD) {
        const hours = Math.floor(ttl / 3600);
        const minutes = Math.floor((ttl % 3600) / 60);
        console.log(`⏭️  ${cityName}: Already cached (TTL: ${hours}h ${minutes}m remaining), skipping...`);
        return true;
      } else if (cached && ttl) {
        console.log(`🔄 ${cityName}: Cache exists but TTL low (${Math.floor(ttl / 60)}m), re-warming...`);
      }
    }

    const coords = await getCachedCityCoordinates(cityName);
    if (!coords) {
      console.log(`⚠️  ${cityName}: No coordinates found in cache. Run geocoding warmer first.`);
      failedCities.push({ name: cityName, error: 'No coordinates', attempts: 1 });
      return false;
    }

    console.log(`🔥 Warming POI cache for ${cityName}...`);
    const success = await warmSingleCell(coords.lat, coords.lng, cityName, skipIfExists);
    if (!success) failedCities.push({ name: cityName, error: 'No POIs found', attempts: 1 });
    return success;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${cityName}: Failed -`, errorMsg);
    const existing = failedCities.find(f => f.name === cityName);
    if (existing) {
      existing.attempts++;
      existing.error = errorMsg;
    } else {
      failedCities.push({ name: cityName, error: errorMsg, attempts: 1 });
    }
    return false;
  }
}

/**
 * Generate and cache AI insights for a single city.
 * Skips automatically if insights are still fresh (> 1 day TTL remaining).
 */
async function warmCityInsights(cityEntry: string): Promise<boolean> {
  // Use only the city name part (strip ", Country")
  const cityName = cityEntry.split(",")[0].trim();
  const cacheKey = CacheKeys.aiCityInsights(cityName);

  const ttl = await redis.ttl(cacheKey);
  if (ttl > 86400) {
    console.log(`  ⏭️  ${cityName}: AI insights fresh (TTL: ${Math.floor(ttl / 86400)}d), skipping`);
    return true;
  }

  try {
    console.log(`  🤖 Generating AI insights for ${cityName}...`);
    const insights = await generateCityInsights(cityName);
    await setCache(cacheKey, insights, CACHE_TTL.AI_CITY_INSIGHTS);
    console.log(`  ✅ ${cityName}: AI insights cached (7 days)`);
    return true;
  } catch (err) {
    console.error(`  ❌ ${cityName}: AI insights failed -`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Check if AI city insights cache is empty (used on startup to decide whether to warm immediately).
 * Samples a known city — if it has no insights, the cache is considered empty.
 */
export async function checkInsightsEmpty(): Promise<boolean> {
  const sampleKey = CacheKeys.aiCityInsights("New York");
  const cached = await getCache(sampleKey);
  return cached === null;
}

/**
 * Sort a city list so the most cache-missed cities are warmed first.
 * Cities with no recorded coordinates (not yet geocoded) stay at the end.
 */
async function sortCitiesByMissCount(cities: string[]): Promise<string[]> {
  const withCounts = await Promise.all(
    cities.map(async (city) => {
      const coords = await getCachedCityCoordinates(city);
      const misses = coords
        ? await getMissCount(getGridCacheKey(coords.lat, coords.lng, RADIUS, [...CATEGORIES]))
        : 0;
      return { city, misses };
    })
  );
  return withCounts
    .sort((a, b) => b.misses - a.misses)
    .map(c => c.city);
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Save failed cities to a file for later retry
 */
async function saveFailedCities(): Promise<void> {
  if (failedCities.length === 0) return;

  const fs = require('fs');
  const path = require('path');

  const failedFile = path.join(__dirname, '../../data/failed_cities.json');
  fs.mkdirSync(path.dirname(failedFile), { recursive: true });
  const data = {
    timestamp: new Date().toISOString(),
    failures: failedCities
  };

  fs.writeFileSync(failedFile, JSON.stringify(data, null, 2));
  console.log(`\n💾 Saved ${failedCities.length} failed cities to ${failedFile}`);
}

/**
 * Load and retry failed cities
 */
async function retryFailedCities(): Promise<void> {
  const fs = require('fs');
  const path = require('path');

  const failedFile = path.join(__dirname, '../../data/failed_cities.json');

  if (!fs.existsSync(failedFile)) {
    console.log('❌ No failed cities file found');
    return;
  }

  const data = JSON.parse(fs.readFileSync(failedFile, 'utf-8'));
  const citiesToRetry = data.failures.map((f: FailedCity) => f.name);

  console.log(`\n🔄 Retrying ${citiesToRetry.length} failed cities...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < citiesToRetry.length; i++) {
    const cityName = citiesToRetry[i];
    const success = await warmCityCache(cityName);
    success ? successCount++ : failCount++;

    if (i < citiesToRetry.length - 1) {
      console.log(`⏳ Waiting ${REQUEST_DELAY / 1000}s before next request...\n`);
      await delay(REQUEST_DELAY);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Retry complete: ${successCount} success, ${failCount} failed`);
  console.log('='.repeat(60));

  // If all succeeded, delete the failed cities file
  if (failCount === 0) {
    fs.unlinkSync(failedFile);
    console.log('🗑️  Deleted failed cities file (all successful)');
  } else {
    await saveFailedCities();
  }
}

/**
 * Main cache warming function with geocoding
 */
export async function warmMajorCities(citiesList?: string[], options?: {
  skipExisting?: boolean;
  saveFailures?: boolean;
}): Promise<void> {
  const skipExisting = options?.skipExisting ?? false;
  const saveFailures = options?.saveFailures ?? true;

  console.log('🚀 Starting cache warming with Nominatim...\n');
  if (skipExisting) {
    console.log(`⏭️  Skip mode: Will skip cached cities with TTL > ${MIN_TTL_THRESHOLD / 60} minutes\n`);
  }

  const rawCities = citiesList || CITIES;

  console.log('📍 Step 1/3: Warming geocoding cache...\n');
  await warmGeocodingCache(rawCities, skipExisting);

  console.log('\n⏳ Waiting 5 seconds before starting POI cache warming...\n');
  await delay(5000);

  console.log('🗺️  Step 2/3: Sorting cities by miss count and warming POI cache...\n');
  const citiesToWarm = await sortCitiesByMissCount(rawCities);
  const topMissed = citiesToWarm.slice(0, 5).join(', ');
  if (topMissed) console.log(`   Most-missed cities first: ${topMissed}\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < citiesToWarm.length; i++) {
    const success = await warmCityCache(citiesToWarm[i], skipExisting);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    if (i < citiesToWarm.length - 1) {
      console.log(`⏳ Waiting ${REQUEST_DELAY / 1000}s before next request...\n`);
      await delay(REQUEST_DELAY);
    }
  }

  console.log('\n🤖 Step 3/3: Warming AI city insights...\n');
  let insightSuccess = 0;
  let insightFail = 0;

  for (let i = 0; i < citiesToWarm.length; i++) {
    const ok = await warmCityInsights(citiesToWarm[i]);
    ok ? insightSuccess++ : insightFail++;

    if (i < citiesToWarm.length - 1) {
      await delay(AI_INSIGHTS_DELAY);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Cache warming finished`);
  console.log(`   Geocoding: done`);
  console.log(`   POI Cache: ${successCount} success, ${failCount} failed`);
  console.log(`   AI Insights: ${insightSuccess} success, ${insightFail} failed`);
  if (skipExisting) {
    console.log(`   Skipped: ${skippedCount} (already cached)`);
  }
  console.log('='.repeat(60));

  // Save failed cities for retry
  if (saveFailures && failedCities.length > 0) {
    await saveFailedCities();
    console.log('\n💡 To retry failed cities, run: npm run warm-cache -- --retry-failed');
  }
}

/**
 * Warm cache for top priority cities
 */
export async function warmTopCities(): Promise<void> {
  await warmMajorCities(CITIES);
}

/**
 * Clear cache ONLY
 */
export async function clearCache(): Promise<void> {
  const deletedCount = await deleteCachePattern('wandrmark:*');
  console.log(`[CACHE] Cleared all cache (${deletedCount} keys)`);
}

async function shutdown() {
  await redis.quit(); // or .disconnect() depending on your Redis client version
  console.log('🔌 Redis connection closed.');
}

/**
 * CLI entrypoint
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--clear-cache')) {
    console.log('🧹 Clearing cache only...');
    await clearCache();
    process.exit(0);
  }

  if (args.includes('--retry-failed')) {
    await retryFailedCities();
    process.exit(0);
  }

  const skipExisting = args.includes('--skip-existing');
  const citiesToWarm = args.filter(arg => !arg.startsWith('--'));

  if (citiesToWarm.length > 0) {
    await warmMajorCities(citiesToWarm, { skipExisting });
  } else {
    await warmTopCities();
  }
}

if (require.main === module) {
  main()
    .then(() => shutdown())
    .catch(async (error) => {
      console.error('Fatal error:', error);
      await shutdown();
      process.exit(1);
    });
}