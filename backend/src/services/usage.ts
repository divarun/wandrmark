import redis from './cache';

// Keys: wandrmark:usage:{ip}:{YYYY-MM-DD}  (Redis Hash, no TTL — permanent)
// Fields: "METHOD:/api/path" → count (HINCRBY)
//
// IPv6 IPs contain colons, so we parse the date by slicing the last 10 chars (:YYYY-MM-DD).
// IP = key.slice("wandrmark:usage:".length, -11)

const KEY_PREFIX = 'wandrmark:usage:';

function usageKey(ip: string, date: string): string {
  return `${KEY_PREFIX}${ip}:${date}`;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function trackRequest(ip: string, method: string, path: string): Promise<void> {
  try {
    const field = `${method}:${path}`;
    await redis.hincrby(usageKey(ip, todayUTC()), field, 1);
    // No expire — records persist forever
  } catch {
    // Never let tracking errors affect the request
  }
}

export interface DayUsage {
  date: string;
  calls: Record<string, number>;
  total: number;
}

export interface IpUsage {
  ip: string;
  days: DayUsage[];
  totalCalls: number;
}

async function parseKey(key: string): Promise<{ ip: string; date: string } | null> {
  // Date is always the last 10 chars; the colon before it is at position -11
  if (key.length < KEY_PREFIX.length + 12) return null;
  const date = key.slice(-10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ip = key.slice(KEY_PREFIX.length, -11); // strip ":{date}"
  return { ip, date };
}

async function loadDayUsage(key: string, date: string): Promise<DayUsage | null> {
  const raw: Record<string, string> | null = await redis.hgetall(key);
  if (!raw || Object.keys(raw).length === 0) return null;

  const calls: Record<string, number> = {};
  let total = 0;
  for (const [field, count] of Object.entries(raw)) {
    const n = Number(count);
    calls[field] = n;
    total += n;
  }
  return { date, calls, total };
}

export async function getIpUsage(ip: string): Promise<IpUsage> {
  const keys: string[] = await redis.keys(`${KEY_PREFIX}${ip}:*`);
  const days: DayUsage[] = [];

  for (const key of keys.sort()) {
    const parsed = await parseKey(key);
    if (!parsed || parsed.ip !== ip) continue;
    const day = await loadDayUsage(key, parsed.date);
    if (day) days.push(day);
  }

  return { ip, days, totalCalls: days.reduce((s, d) => s + d.total, 0) };
}

export async function getAllUsage(): Promise<IpUsage[]> {
  const keys: string[] = await redis.keys(`${KEY_PREFIX}*`);

  // Group keys by IP
  const ipKeys = new Map<string, { key: string; date: string }[]>();
  for (const key of keys) {
    const parsed = await parseKey(key);
    if (!parsed) continue;
    if (!ipKeys.has(parsed.ip)) ipKeys.set(parsed.ip, []);
    ipKeys.get(parsed.ip)!.push({ key, date: parsed.date });
  }

  const results: IpUsage[] = [];
  for (const [ip, entries] of ipKeys) {
    const days: DayUsage[] = [];
    for (const { key, date } of entries.sort((a, b) => a.date.localeCompare(b.date))) {
      const day = await loadDayUsage(key, date);
      if (day) days.push(day);
    }
    results.push({ ip, days, totalCalls: days.reduce((s, d) => s + d.total, 0) });
  }

  return results;
}
