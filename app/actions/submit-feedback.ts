"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { feedbackSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase-server";

export type FeedbackResult =
  | { status: "success" }
  | { status: "invalid"; message: string }
  | { status: "rate_limited" }
  | { status: "error" };

function hashIp(ip: string): string {
  const secret = process.env.WAITLIST_RATE_LIMIT_SECRET ?? "dev-salt";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}:${secret}:${day}`).digest("hex");
}

function getClientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

/** Beta feedback — written to the Supabase `feedback` table (service role only). */
export async function submitFeedback(input: {
  message: string;
  email?: string;
}): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "That doesn't look right.",
    };
  }

  const h = headers();
  const ipHash = hashIp(getClientIp(h));
  const { ok } = checkRateLimit(ipHash);
  if (!ok) return { status: "rate_limited" };

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("feedback").insert({
      message: parsed.data.message,
      email: parsed.data.email || null,
      user_agent: h.get("user-agent")?.slice(0, 512) ?? null,
    });
    if (error) {
      console.error("[feedback] insert error:", error.message);
      return { status: "error" };
    }
    return { status: "success" };
  } catch (err) {
    console.error("[feedback] unexpected error:", err);
    return { status: "error" };
  }
}
