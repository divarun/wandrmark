import redis from './cache';

// Sorted sets (no TTL — permanent):
//   wandrmark:analytics:cities      ZSET  city name → insight request count
//   wandrmark:analytics:searches    ZSET  geocode query → count
//   wandrmark:analytics:categories  ZSET  POI category → count
//   wandrmark:analytics:transport   ZSET  routing mode → count
//
// Daily activity hash (no TTL — permanent):
//   wandrmark:analytics:daily:YYYY-MM-DD  HASH  field → count
//   Fields: cityInsights, geocodeSearches, overpassQueries, routes

const KEYS = {
  cities:     'wandrmark:analytics:cities',
  searches:   'wandrmark:analytics:searches',
  categories: 'wandrmark:analytics:categories',
  transport:  'wandrmark:analytics:transport',
  daily:      (date: string) => `wandrmark:analytics:daily:${date}`,
};

const useUpstash = !!process.env.UPSTASH_REDIS_REST_URL;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function zincrAndDaily(zsetKey: string, member: string, dailyField: string): Promise<void> {
  try {
    await Promise.all([
      redis.zincrby(zsetKey, 1, member),
      redis.hincrby(KEYS.daily(todayUTC()), dailyField, 1),
    ]);
  } catch {
    // Never let analytics errors affect the caller
  }
}

export async function trackCityInsight(cityName: string): Promise<void> {
  const city = cityName.split(',')[0].trim();
  if (!city) return;
  await zincrAndDaily(KEYS.cities, city, 'cityInsights');
}

export async function trackGeocodeSearch(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  await zincrAndDaily(KEYS.searches, q.toLowerCase(), 'geocodeSearches');
}

export async function trackOverpassCategories(categories: string[]): Promise<void> {
  if (categories.length === 0) return;
  try {
    await Promise.all([
      ...categories.map(cat => redis.zincrby(KEYS.categories, 1, cat)),
      redis.hincrby(KEYS.daily(todayUTC()), 'overpassQueries', 1),
    ]);
  } catch {}
}

export async function trackTransportMode(mode: string): Promise<void> {
  await zincrAndDaily(KEYS.transport, mode, 'routes');
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export interface RankedEntry {
  name: string;
  count: number;
}

export interface DailyActivity {
  date: string;
  cityInsights: number;
  geocodeSearches: number;
  overpassQueries: number;
  routes: number;
}

export interface AnalyticsStats {
  topCities: RankedEntry[];
  topSearches: RankedEntry[];
  categories: Record<string, number>;
  transport: Record<string, number>;
  daily: DailyActivity[];
}

async function topN(key: string, n: number): Promise<RankedEntry[]> {
  try {
    // Both ioredis and @upstash/redis return a flat interleaved array:
    // [member, score, member, score, ...]
    const raw: (string | number)[] = useUpstash
      ? await redis.zrange(key, 0, n - 1, { rev: true, withScores: true })
      : await redis.zrevrange(key, 0, n - 1, 'WITHSCORES');
    const result: RankedEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ name: String(raw[i]), count: Number(raw[i + 1]) });
    }
    return result;
  } catch {
    return [];
  }
}

async function allFromZSet(key: string): Promise<Record<string, number>> {
  try {
    // Both ioredis and @upstash/redis return a flat interleaved array:
    // [member, score, member, score, ...]
    const raw: (string | number)[] = useUpstash
      ? await redis.zrange(key, 0, -1, { withScores: true })
      : await redis.zrange(key, 0, -1, 'WITHSCORES');
    const result: Record<string, number> = {};
    for (let i = 0; i < raw.length; i += 2) {
      result[String(raw[i])] = Number(raw[i + 1]);
    }
    return result;
  } catch {
    return {};
  }
}

async function loadDailyActivity(): Promise<DailyActivity[]> {
  try {
    const keys: string[] = await redis.keys('wandrmark:analytics:daily:*');
    const days: DailyActivity[] = [];

    for (const key of keys.sort()) {
      const date = key.slice('wandrmark:analytics:daily:'.length);
      const raw: Record<string, string> | null = await redis.hgetall(key);
      if (!raw) continue;
      days.push({
        date,
        cityInsights:    Number(raw.cityInsights    ?? 0),
        geocodeSearches: Number(raw.geocodeSearches ?? 0),
        overpassQueries: Number(raw.overpassQueries ?? 0),
        routes:          Number(raw.routes          ?? 0),
      });
    }

    return days;
  } catch {
    return [];
  }
}

export async function getAnalyticsStats(): Promise<AnalyticsStats> {
  const [topCities, topSearches, categories, transport, daily] = await Promise.all([
    topN(KEYS.cities, 20),
    topN(KEYS.searches, 20),
    allFromZSet(KEYS.categories),
    allFromZSet(KEYS.transport),
    loadDailyActivity(),
  ]);

  return { topCities, topSearches, categories, transport, daily };
}
