import redis from './cache';

// Bug reports: RPUSH wandrmark:bugs {JSON}  — List, no TTL
// Stars:       SADD  wandrmark:stars {ip}   — Set, no TTL (deduplication built-in)

const BUGS_KEY  = 'wandrmark:bugs';
const STARS_KEY = 'wandrmark:stars';

export interface BugReport {
  id: string;
  ip: string;
  message: string;
  ts: string;
}

// @upstash/redis auto-parses JSON on LRANGE; ioredis returns raw strings.
function parseBugReport(val: unknown): BugReport {
  if (typeof val === 'string') return JSON.parse(val) as BugReport;
  return val as BugReport;
}

export async function submitBug(ip: string, message: string): Promise<BugReport> {
  const report: BugReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ip,
    message,
    ts: new Date().toISOString(),
  };
  await redis.rpush(BUGS_KEY, JSON.stringify(report));
  return report;
}

export async function getBugReports(): Promise<BugReport[]> {
  const raw: unknown[] = await redis.lrange(BUGS_KEY, 0, -1);
  return raw.map(parseBugReport);
}

export async function toggleStar(ip: string): Promise<{ total: number; starred: boolean }> {
  const isMember = await redis.sismember(STARS_KEY, ip);
  if (isMember) {
    await redis.srem(STARS_KEY, ip);
  } else {
    await redis.sadd(STARS_KEY, ip);
  }
  const total: number = await redis.scard(STARS_KEY);
  return { total, starred: !isMember };
}

export async function getStarStatus(ip: string): Promise<{ total: number; starred: boolean }> {
  const [isMember, total] = await Promise.all([
    redis.sismember(STARS_KEY, ip),
    redis.scard(STARS_KEY),
  ]);
  return { total: total as number, starred: !!isMember };
}

export async function getFeedbackStats(): Promise<{ stars: number; bugReports: number }> {
  const [stars, bugReports] = await Promise.all([
    redis.scard(STARS_KEY),
    redis.llen(BUGS_KEY),
  ]);
  return { stars: stars as number, bugReports: bugReports as number };
}
