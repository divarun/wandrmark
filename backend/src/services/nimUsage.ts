import redis from './cache';

// Keys (no TTL — permanent):
//   wandrmark:nim:calls:total           STRING  — total successful NIM calls
//   wandrmark:nim:calls:<endpoint>      STRING  — per-endpoint call count
//   wandrmark:nim:tokens:total          STRING  — total estimated tokens
//   wandrmark:nim:tokens:<endpoint>     STRING  — per-endpoint estimated tokens
//   wandrmark:nim:daily:<YYYY-MM-DD>    HASH    — { <endpoint>: count } per day

const ENDPOINTS = [
  "recommendations",
  "travel-tips",
  "neighborhood-fact",
  "historical-context",
  "city-insights",
  "city-summary",
] as const;

export type NimEndpoint = (typeof ENDPOINTS)[number];

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function estimateTokens(promptChars: number, responseChars: number): number {
  return Math.ceil((promptChars + responseChars) / 4);
}

export async function trackNimCall(
  endpoint: NimEndpoint,
  promptChars: number,
  responseChars: number
): Promise<void> {
  try {
    const tokens = estimateTokens(promptChars, responseChars);
    await Promise.all([
      redis.incr("wandrmark:nim:calls:total"),
      redis.incr(`wandrmark:nim:calls:${endpoint}`),
      redis.incrby("wandrmark:nim:tokens:total", tokens),
      redis.incrby(`wandrmark:nim:tokens:${endpoint}`, tokens),
      redis.hincrby(`wandrmark:nim:daily:${todayUTC()}`, endpoint, 1),
    ]);
  } catch {
    // Never let tracking errors affect the caller
  }
}

export interface EndpointStats {
  calls: number;
  estimatedTokens: number;
}

export interface DayStats {
  date: string;
  calls: Record<string, number>;
  total: number;
}

export interface NimUsageStats {
  totalCalls: number;
  estimatedTokens: number;
  byEndpoint: Record<NimEndpoint, EndpointStats>;
  daily: DayStats[];
}

export async function getNimUsage(): Promise<NimUsageStats> {
  const [totalCallsRaw, totalTokensRaw, ...endpointRaws] = await Promise.all([
    redis.get("wandrmark:nim:calls:total"),
    redis.get("wandrmark:nim:tokens:total"),
    ...ENDPOINTS.flatMap((ep) => [
      redis.get(`wandrmark:nim:calls:${ep}`),
      redis.get(`wandrmark:nim:tokens:${ep}`),
    ]),
  ]);

  const byEndpoint = {} as Record<NimEndpoint, EndpointStats>;
  ENDPOINTS.forEach((ep, i) => {
    byEndpoint[ep] = {
      calls: Number(endpointRaws[i * 2] ?? 0),
      estimatedTokens: Number(endpointRaws[i * 2 + 1] ?? 0),
    };
  });

  const dailyKeys: string[] = await redis.keys("wandrmark:nim:daily:*");
  const daily: DayStats[] = [];

  for (const key of dailyKeys.sort()) {
    const date = key.slice("wandrmark:nim:daily:".length);
    const raw: Record<string, string> | null = await redis.hgetall(key);
    if (!raw) continue;
    const calls: Record<string, number> = {};
    let total = 0;
    for (const [ep, count] of Object.entries(raw)) {
      calls[ep] = Number(count);
      total += Number(count);
    }
    daily.push({ date, calls, total });
  }

  return {
    totalCalls: Number(totalCallsRaw ?? 0),
    estimatedTokens: Number(totalTokensRaw ?? 0),
    byEndpoint,
    daily,
  };
}
