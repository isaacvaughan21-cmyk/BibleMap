import "server-only";
import { Resend } from "resend";

/**
 * Best-effort add of an email to the Resend marketing Audience.
 *
 * Only OPTED-IN sign-ups ever reach this — every sign-up surface gates on an
 * explicit marketing consent (the landing waitlist and mobile "notify me" are
 * opt-in by intent; the in-app gate has a consent checkbox). This helper is:
 *   - idempotent — Resend skips an email already in the audience;
 *   - non-throwing — a marketing-list hiccup must NEVER break account creation;
 *   - a no-op when RESEND_API_KEY / RESEND_AUDIENCE_ID aren't set (e.g. local
 *     dev), so the app behaves identically with or without Resend configured.
 *
 * It never re-subscribes someone who unsubscribed: we only ever create a new
 * contact (existing ones are left untouched), so a prior `unsubscribed: true`
 * set via a Broadcast stands.
 */
export async function addToAudience(email: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) return; // Resend not configured — skip silently.

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.contacts.create({
      audienceId,
      email,
      unsubscribed: false,
    });
    // "already exists" is the happy path for a returning sign-up — ignore it.
    if (error && !/exist/i.test(error.message ?? "")) {
      console.error("[resend-audience] add failed:", error.message);
    }
  } catch (err) {
    console.error(
      "[resend-audience] unexpected error:",
      err instanceof Error ? err.message : err,
    );
  }
}
