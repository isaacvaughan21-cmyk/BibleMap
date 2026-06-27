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
 * It never re-subscribes someone who unsubscribed: `contacts.create` UPSERTS
 * (and would reset `unsubscribed` to false), so we look the contact up first
 * and leave any existing contact completely untouched — a prior unsubscribe set
 * via a Broadcast always stands.
 */
export async function addToAudience(email: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) return; // Resend not configured — skip silently.

  try {
    const resend = new Resend(apiKey);

    // Already a contact? Leave them exactly as-is (preserves any unsubscribe).
    const existing = await resend.contacts.get({ audienceId, email });
    if (existing.data) return;

    const { error } = await resend.contacts.create({
      audienceId,
      email,
      unsubscribed: false,
    });
    if (error) {
      console.error("[resend-audience] add failed:", error.message);
    }
  } catch (err) {
    console.error(
      "[resend-audience] unexpected error:",
      err instanceof Error ? err.message : err,
    );
  }
}
