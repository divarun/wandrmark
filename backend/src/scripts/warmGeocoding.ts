import { setCache, getCache, CACHE_TTL } from '../services/cache';
import crypto from 'crypto';
import { CITIES } from '../data/cities';
import redis from '../services/cache';

const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";

// Delay between requests to respect Nominatim rate limits
const REQUEST_DELAY = 1000; // 1 second (Nominatim allows 1 req/sec)

// Minimum TTL threshold for geocoding cache - if less than this, re-fetch
const MIN_GEOCODING_TTL = 43200; // 12 hours (half of 24 hour TTL)

interface GeocodedCity {
  query: string;
  displayName: string;
  lat: number;
  lng: number;
  type: string;
  country: string;
}

/**
 * Geocode a city using Nominatim
 */
async function geocodeCity(cityQuery: string): Promise<GeocodedCity | null> {
  try {
    const params = new URLSearchParams({
      q: cityQuery,
      format: 'json',
      limit: '5',              // FIX: Changed from 1 to 5 to match frontend
      addressdetails: '1',
      extratags: '1',          // FIX: Added to match frontend
    });

    const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: {
        'User-Agent': 'Wandrmark-GeocodeWarmer/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim error ${response.status}`);
    }

    const data = await response.json() as any;

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      query: cityQuery,
      displayName: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      type: result.type || 'city',
      country: result.address?.country || '',
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Generate cache key for geocoding
 * FIX: Updated to match frontend proxy cache key format exactly
 */
function getGeocodeCacheKey(query: string): string {
  const normalizedQuery = query.trim().toLowerCase();
  // Match the exact format frontend sends: limit=5 and includes extratags=1
  return `wandrmark:nominatim:search:q=${normalizedQuery}&format=json&limit=5&addressdetails=1&extratags=1`;
}

/**
 * Check if geocoding is already cached with sufficient TTL
 */
async function isGeocodingCached(cityQuery: string): Promise<{ cached: boolean; ttl?: number }> {
  try {
    const cacheKey = getGeocodeCacheKey(cityQuery);

    // Check if key exists
    const cached = await getCache(cacheKey);
    if (!cached) {
      return { cached: false };
    }

    // Check TTL
    const ttl = await redis.ttl(cacheKey);

    if (ttl === -2) {
      return { cached: false };
    }

    return { cached: true, ttl };
  } catch (error) {
    console.error(`Error checking geocoding cache for ${cityQuery}:`, error);
    return { cached: false };
  }
}

/**
 * Warm geocoding cache for a single city
 */
async function warmCityGeocode(cityQuery: string, skipIfExists = false): Promise<boolean> {
  try {
    // Skip if already cached with sufficient TTL
    if (skipIfExists) {
      const { cached, ttl } = await isGeocodingCached(cityQuery);

      if (cached) {
        if (ttl && ttl > MIN_GEOCODING_TTL) {
          const hours = Math.floor(ttl / 3600);
          console.log(`⏭️  ${cityQuery}: Already geocoded (TTL: ${hours}h remaining), skipping...`);
          return true;
        } else if (ttl) {
          const hours = Math.floor(ttl / 3600);
          console.log(`🔄 ${cityQuery}: Cache exists but TTL low (${hours}h), re-geocoding...`);
        }
      }
    }

    console.log(`🌍 Geocoding: ${cityQuery}...`);

    const result = await geocodeCity(cityQuery);

    if (!result) {
      console.log(`⚠️  ${cityQuery}: Not found in Nominatim`);
      return false;
    }

    // Cache the Nominatim response in the same format the proxy would
    // FIX: Store full array response to match what frontend expects (limit=5)
    const cacheKey = getGeocodeCacheKey(cityQuery);
    const cacheData = [{
      place_id: result.query,
      display_name: result.displayName,
      lat: result.lat.toString(),
      lon: result.lng.toString(),
      type: result.type,
      category: 'place',
    }];

    await setCache(cacheKey, cacheData, CACHE_TTL.NOMINATIM);

    console.log(`✅ ${cityQuery}: (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}) - ${result.country}`);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ ${cityQuery}: Failed -`, error.message);
    }
    return false;
  }
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Warm geocoding cache for all cities
 */
export async function warmGeocodingCache(citiesList?: string[], skipIfExists = false): Promise<void> {
  console.log('🚀 Starting geocoding cache warming...\n');

  if (skipIfExists) {
    console.log(`⏭️  Skip mode: Will skip cached cities with TTL > ${MIN_GEOCODING_TTL / 3600} hours\n`);
  }

  const citiesToGeocode = citiesList || CITIES;
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < citiesToGeocode.length; i++) {
    const cityQuery = citiesToGeocode[i];

    const success = await warmCityGeocode(cityQuery, skipIfExists);
    if (success) {
      successCount++;
      // Check if it was actually skipped
      const { cached, ttl } = await isGeocodingCached(cityQuery);
      if (skipIfExists && cached && ttl && ttl > MIN_GEOCODING_TTL) {
        skippedCount++;
      }
    } else {
      failCount++;
    }

    // Respect Nominatim rate limit (1 request per second)
    if (i < citiesToGeocode.length - 1) {
      await delay(REQUEST_DELAY);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Geocoding cache warming complete!`);
  console.log(`   Success: ${successCount} cities`);
  if (skipIfExists && skippedCount > 0) {
    console.log(`   Skipped: ${skippedCount} cities (already cached)`);
  }
  console.log(`   Failed: ${failCount} cities`);
  console.log(`   Cache TTL: ${CACHE_TTL.NOMINATIM / 3600} hours`);
  console.log('='.repeat(50));
}

/**
 * Get cached coordinates for a city
 */
export async function getCachedCityCoordinates(cityName: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = getGeocodeCacheKey(cityName);
  const cached = await getCache<any[]>(cacheKey);

  if (cached && cached.length > 0) {
    return {
      lat: parseFloat(cached[0].lat),
      lng: parseFloat(cached[0].lon),
    };
  }

  return null;
}

// If running as a standalone script
if (require.main === module) {
  const args = process.argv.slice(2);
  const skipExisting = args.includes('--skip-existing');
  const citiesToGeocode = args.filter(arg => !arg.startsWith('--'));

  if (citiesToGeocode.length > 0) {
    // Geocode specific cities
    warmGeocodingCache(citiesToGeocode, skipExisting)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
  } else {
    // Geocode all cities
    warmGeocodingCache(undefined, skipExisting)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
  }
}