"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { waitlistSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase-server";

export type WaitlistResult =
  | { status: "success" }
  | { status: "duplicate" }
  | { status: "invalid"; message: string }
  | { status: "rate_limited" }
  | { status: "error" };

/**
 * Hash the client IP with a daily-rotating salt so we never store raw IPs.
 * sha256(ip + secret + yyyy-mm-dd). The daily component limits long-term
 * correlation while still allowing same-day rate limiting.
 */
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

export async function joinWaitlist(
  _prev: WaitlistResult | null,
  formData: FormData
): Promise<WaitlistResult> {
  // 1. Validate.
  const parsed = waitlistSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Enter a valid email address.";
    return { status: "invalid", message };
  }
  const { email } = parsed.data;

  // 2. Derive ip_hash and rate-limit on it.
  const h = headers();
  const ipHash = hashIp(getClientIp(h));
  const userAgent = h.get("user-agent")?.slice(0, 512) ?? null;

  const { ok } = checkRateLimit(ipHash);
  if (!ok) return { status: "rate_limited" };

  // 3. Insert through the service-role client.
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("waitlist").insert({
      email,
      source: "landing",
      user_agent: userAgent,
      ip_hash: ipHash,
    });

    if (error) {
      // Postgres unique_violation
      if (error.code === "23505") return { status: "duplicate" };
      console.error("[waitlist] insert error:", error.message);
      return { status: "error" };
    }

    return { status: "success" };
  } catch (err) {
    console.error("[waitlist] unexpected error:", err);
    return { status: "error" };
  }
}
