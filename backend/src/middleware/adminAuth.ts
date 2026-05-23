import crypto from "crypto";
import { Request, Response } from "express";

const IS_PROD = process.env.NODE_ENV === "production";
const ALLOWED_IPS: string[] = process.env.ALLOWED_IPS
  ? process.env.ALLOWED_IPS.split(",").map((ip) => ip.trim())
  : [];

function getClientIP(req: Request): string {
  return (req.ip ?? req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
}

export function isWhitelistedIP(req: Request): boolean {
  const ip = getClientIP(req);
  if (!IS_PROD && (ip === "127.0.0.1" || ip === "::1")) return true;
  return ALLOWED_IPS.includes(ip);
}

/**
 * Authorizes admin requests via x-cache-secret header OR whitelisted IP.
 * If no secret is configured, all requests are allowed (dev mode).
 * Sends 401 and returns false if unauthorized.
 */
export function checkAdminAuth(req: Request, res: Response): boolean {
  const secret = process.env.CACHE_WARM_SECRET;
  if (!secret) return true; // dev mode — secret not configured
  if (isWhitelistedIP(req)) return true;
  const provided = req.headers["x-cache-secret"];
  if (typeof provided !== "string") {
    res.status(401).json({ error: "Invalid or missing x-cache-secret header" });
    return false;
  }
  const secretBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (secretBuf.length !== providedBuf.length || !crypto.timingSafeEqual(secretBuf, providedBuf)) {
    res.status(401).json({ error: "Invalid or missing x-cache-secret header" });
    return false;
  }
  return true;
}
