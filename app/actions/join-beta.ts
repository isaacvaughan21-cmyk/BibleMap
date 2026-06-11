"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { waitlistSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Beta sign-up — v0 has no real auth backend yet, so this records the email
 * in the existing `waitlist` table (source "app-beta") and nothing more.
 * The password NEVER reaches this action: the client keeps it local until
 * real accounts ship.
 *
 * Deliberately forgiving: a beta tester is never locked out of the canvas by
 * a backend hiccup. Only a malformed email is rejected; rate-limited or
 * failed inserts log and fall through as success.
 */

export type BetaSignupResult =
  | { status: "ok" }
  | { status: "invalid"; message: string };

function hashIp(ip: string): string {
  const secret = process.env.WAITLIST_RATE_LIMIT_SECRET ?? "dev-salt";
  const day = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  return createHash("sha256").update(`${ip}:${secret}:${day}`).digest("hex");
}

function getClientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

export async function joinBeta(formData: FormData): Promise<BetaSignupResult> {
  const parsed = waitlistSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Enter a valid email address.";
    return { status: "invalid", message };
  }
  const { email } = parsed.data;

  const h = headers();
  const ipHash = hashIp(getClientIp(h));
  const userAgent = h.get("user-agent")?.slice(0, 512) ?? null;

  const { ok } = checkRateLimit(ipHash);
  if (!ok) return { status: "ok" }; // skip the insert, never block entry

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("waitlist").insert({
      email,
      source: "app-beta",
      user_agent: userAgent,
      ip_hash: ipHash,
    });
    // 23505 = already on the list — for a sign-up that's simply "welcome back"
    if (error && error.code !== "23505") {
      console.error("[beta] insert error:", error.message);
    }
  } catch (err) {
    console.warn(
      "[beta] sign-up not persisted (backend not configured):",
      err instanceof Error ? err.message : err,
    );
  }
  return { status: "ok" };
}
