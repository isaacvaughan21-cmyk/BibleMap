import { createHash } from "node:crypto";

/**
 * Per-IP rate-limit helpers for server actions.
 *
 * Extracted verbatim from the original inline copy in
 * app/actions/submit-feedback.ts so the feedback action and the ask-scripture
 * action share one implementation. The hash is salted with a daily-rotating
 * secret: a stored key can't be reversed to an IP and it expires each day.
 */

export function hashIp(ip: string): string {
  const secret = process.env.WAITLIST_RATE_LIMIT_SECRET ?? "dev-salt";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}:${secret}:${day}`).digest("hex");
}

export function getClientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}
