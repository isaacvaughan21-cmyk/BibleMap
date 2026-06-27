/**
 * Sync Hodos's OPTED-IN contacts into a Resend Audience.
 *
 * Source = the `waitlist` table only. Every row there is a marketing opt-in:
 * the landing waitlist and mobile "notify me" forms are opt-in by intent, and
 * the in-app sign-up writes here only when the consent checkbox is ticked.
 *
 * `user_maps` is deliberately NOT a source — it's just "who uses the app" and
 * includes guests-turned-account and people who declined updates, so syncing it
 * would add un-consented addresses to the marketing list.
 *
 * New sign-ups now auto-flow into the audience from the server actions
 * (lib/resend-audience.ts), so this script is mainly a backfill / repair tool —
 * safe to re-run anytime. It upserts each email as a contact; once synced you
 * compose & send newsletters from the Resend dashboard as Broadcasts (which
 * carry a built-in, compliant unsubscribe link).
 *
 * The script is idempotent: re-running it only adds people who aren't already
 * in the audience. Contacts that already exist are reported as "skipped", and
 * anyone who previously unsubscribed via a Broadcast is NEVER re-subscribed
 * (we never touch the `unsubscribed` flag on an existing contact).
 *
 * Required env (put these in .env.local — see .env.example):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   — server-only; bypasses RLS to read every row
 *   RESEND_API_KEY
 *   RESEND_AUDIENCE_ID          — create an Audience in the Resend dashboard
 *
 * Run:
 *   node --env-file=.env.local scripts/sync-resend-audience.mjs            # live
 *   node --env-file=.env.local scripts/sync-resend-audience.mjs --dry-run  # preview only
 *
 * Or via npm:
 *   npm run sync:audience
 *   npm run sync:audience -- --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const DRY_RUN = process.argv.includes("--dry-run");

// ---- env ------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
  ["RESEND_API_KEY", RESEND_API_KEY],
  ["RESEND_AUDIENCE_ID", AUDIENCE_ID],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`Missing required env var(s): ${missing.join(", ")}`);
  console.error("Set them in .env.local, then re-run.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const resend = new Resend(RESEND_API_KEY);

// ---- helpers --------------------------------------------------------------

/** Read every `email` from a table, paging past Supabase's 1000-row cap. */
async function fetchEmails(table) {
  const PAGE = 1000;
  const emails = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("email")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[${table}] ${error.message}`);
    if (!data?.length) break;
    for (const row of data) if (row.email) emails.push(row.email);
    if (data.length < PAGE) break;
  }
  return emails;
}

/** Lowercase + trim, drop blanks and anything without a plausible @x.y. */
function normalize(list) {
  const out = new Set();
  for (const raw of list) {
    const e = String(raw).trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) out.add(e);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- run ------------------------------------------------------------------

const waitlistEmails = await fetchEmails("waitlist");
const all = normalize(waitlistEmails);

console.log("Opted-in contacts gathered (waitlist table):");
console.log(`  raw rows : ${waitlistEmails.length}`);
console.log(`  unique   : ${all.size} valid`);

if (DRY_RUN) {
  console.log(
    "\n[dry run] No contacts written. Re-run without --dry-run to sync.",
  );
  process.exit(0);
}

let created = 0;
let skipped = 0; // already in the audience
let failed = 0;
const errorSamples = [];

// Sequential with a small delay — well under Resend's rate limit and gentle
// enough that a few thousand contacts sync without tripping 429s.
const emails = [...all];
for (let i = 0; i < emails.length; i++) {
  const email = emails[i];
  try {
    const { error } = await resend.contacts.create({
      audienceId: AUDIENCE_ID,
      email,
      unsubscribed: false,
    });
    if (error) {
      // Resend returns an error when the contact already exists in the audience.
      if (/exist/i.test(error.message ?? "")) {
        skipped++;
      } else {
        failed++;
        if (errorSamples.length < 5)
          errorSamples.push(`${email}: ${error.message}`);
      }
    } else {
      created++;
    }
  } catch (err) {
    failed++;
    if (errorSamples.length < 5) {
      errorSamples.push(
        `${email}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  if ((i + 1) % 50 === 0) console.log(`  …processed ${i + 1}/${emails.length}`);
  await sleep(120);
}

console.log("\nDone.");
console.log(`  created : ${created}`);
console.log(`  skipped : ${skipped} (already in audience)`);
console.log(`  failed  : ${failed}`);
if (errorSamples.length) {
  console.log("  first errors:");
  for (const s of errorSamples) console.log(`    - ${s}`);
}
