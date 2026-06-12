import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for auth + cloud sync, using the PUBLIC anon key
 * (safe to ship to the client; constrained by row-level security).
 *
 * Cloud features are OPT-IN by configuration: if the URL or anon key isn't
 * set, this returns null and the app stays fully local-first (the WelcomeGate
 * falls back to on-device accounts). So shipping this never changes behaviour
 * until the anon key is added to the environment.
 */

let cached: SupabaseClient | null | undefined;

export function getBrowserClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached =
    url && anon
      ? createClient(url, anon, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            storageKey: "hodos.auth",
          },
        })
      : null;
  return cached;
}

/** True when cloud auth + sync are configured (anon key present). */
export const isCloudEnabled = (): boolean => getBrowserClient() !== null;
