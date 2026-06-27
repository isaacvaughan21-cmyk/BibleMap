/**
 * One-off backfill: copy `user_maps` owner emails into the `waitlist` table.
 *
 * Context: the very first Resend sync added all app users (from user_maps) to
 * the marketing audience before the "opt-ins only" rule existed. Rather than
 * prune them, we're treating those existing users as on the list — so we mirror
 * any user_maps email that isn't already in `waitlist` into `waitlist` (with
 * source 'user-map-backfill'). This realigns Supabase with the Resend audience
 * and keeps them in scope for the waitlist-only sync going forward.
 *
 * Idempotent: existing emails are skipped (unique constraint on waitlist.email,
 * via upsert ignoreDuplicates). Safe to re-run.
 *
 * Required env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run:
 *   node --env-file=.env.local scripts/backfill-waitlist-from-usermaps.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-waitlist-from-usermaps.mjs
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`Missing required env var(s): ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

function normalize(list) {
  const out = new Set();
  for (const raw of list) {
    const e = String(raw).trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) out.add(e);
  }
  return out;
}

const [waitlistRaw, userMapRaw] = await Promise.all([
  fetchEmails("waitlist"),
  fetchEmails("user_maps"),
]);

const inWaitlist = normalize(waitlistRaw);
const inUserMaps = normalize(userMapRaw);

const toAdd = [...inUserMaps].filter((e) => !inWaitlist.has(e));

console.log(`waitlist  : ${inWaitlist.size} valid`);
console.log(`user_maps : ${inUserMaps.size} valid`);
console.log(`to add    : ${toAdd.length} (in user_maps, not yet in waitlist)`);
for (const e of toAdd) console.log(`    + ${e}`);

if (toAdd.length === 0) {
  console.log(
    "\nNothing to backfill — waitlist already covers every user_maps email.",
  );
  process.exit(0);
}

if (DRY_RUN) {
  console.log(
    "\n[dry run] No rows written. Re-run without --dry-run to insert.",
  );
  process.exit(0);
}

const rows = toAdd.map((email) => ({ email, source: "user-map-backfill" }));
const { error } = await supabase
  .from("waitlist")
  .upsert(rows, { onConflict: "email", ignoreDuplicates: true });

if (error) {
  console.error("\nInsert failed:", error.message);
  process.exit(1);
}

console.log(`\nDone. Inserted ${rows.length} email(s) into waitlist.`);
