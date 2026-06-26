"use server";

import { headers } from "next/headers";
import { feedbackSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { getServiceClient } from "@/lib/supabase-server";

export type FeedbackResult =
  | { status: "success" }
  | { status: "invalid"; message: string }
  | { status: "rate_limited" }
  | { status: "error" };

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
