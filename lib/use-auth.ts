"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase-browser";

/**
 * Auth helpers over Supabase Auth (email/password). All no-op gracefully when
 * cloud isn't configured (no anon key) — callers fall back to local accounts.
 */

export type AuthResult =
  | { ok: true; needsConfirm: boolean }
  | { ok: false; error: string };

export async function cloudSignUp(
  email: string,
  password: string,
): Promise<AuthResult> {
  const client = getBrowserClient();
  if (!client)
    return { ok: false, error: "Cloud accounts aren't enabled yet." };
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  // No session means the project requires email confirmation.
  return { ok: true, needsConfirm: !data.session };
}

export async function cloudSignIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const client = getBrowserClient();
  if (!client)
    return { ok: false, error: "Cloud accounts aren't enabled yet." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, needsConfirm: false };
}

export async function cloudSignOut(): Promise<void> {
  await getBrowserClient()?.auth.signOut();
}

/** The current signed-in user (null when signed out or cloud disabled). */
export function useAuthUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getBrowserClient();
    if (!client) {
      setLoading(false);
      return;
    }
    let mounted = true;
    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
