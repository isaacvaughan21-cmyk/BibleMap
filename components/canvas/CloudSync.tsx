"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useAuthUser } from "@/lib/use-auth";
import { pullCloud, pushCloud } from "@/lib/cloud-sync";

/**
 * Keeps a signed-in user's canvases mirrored to the cloud. Renders nothing.
 *  - On sign-in (or an existing session at load): pull the cloud snapshot and
 *    merge it into local, then refresh the canvas.
 *  - On local change: push the whole tree up, debounced.
 * Inert when cloud isn't configured (useAuthUser stays null) — no-op.
 */
export default function CloudSync() {
  const { user } = useAuthUser();
  const rehydrate = useCanvasStore((s) => s.rehydrate);
  // A cheap change signal — node + edge counts and the save state tick.
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const edgeCount = useCanvasStore((s) => s.edges.length);
  const saveState = useCanvasStore((s) => s.saveState);

  const pulledFor = useRef<string | null>(null);
  // Becomes the user id only AFTER the pull resolves — pushing is blocked until
  // then so a not-yet-synced device can't overwrite the cloud with stale data.
  const readyFor = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull once per signed-in user; rehydrate the store when cloud data lands.
  useEffect(() => {
    if (!user) {
      pulledFor.current = null;
      readyFor.current = null;
      return;
    }
    if (pulledFor.current === user.id) return;
    pulledFor.current = user.id;
    const id = user.id;
    void pullCloud(id)
      .then((changed) => (changed ? rehydrate() : undefined))
      .finally(() => {
        readyFor.current = id;
        // Reconcile local up to the cloud once (e.g. a guest's existing work
        // entering a new account). Guarded so it can never wipe the cloud.
        void pushCloud(id);
      });
  }, [user, rehydrate]);

  // Push on change (debounced) — only once the pull for this user is done.
  useEffect(() => {
    if (!user || readyFor.current !== user.id) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    const id = user.id;
    pushTimer.current = setTimeout(() => {
      void pushCloud(id);
    }, 2500);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [user, nodeCount, edgeCount, saveState]);

  return null;
}
