import * as repo from "@/lib/db/repo";
import { getBrowserClient } from "@/lib/supabase-browser";

/**
 * Cloud sync of the whole workspace — a pragmatic, full-snapshot,
 * last-write-wins strategy (no CRDT). One JSONB row per user in `user_maps`.
 *
 * A snapshot carries BOTH the map tree (nodes + edges across every canvas and
 * nested map) AND the workspace meta (the canvas registry, active canvas,
 * names, version) so a fresh device sees the same canvases, not just orphaned
 * bubbles.
 *
 *  - pullCloud(): merge the cloud tree into local (newer updatedAt wins) and
 *    union the canvas registry, so signing in on a new device brings your
 *    workspace down without clobbering fresher local edits.
 *  - pushCloud(): upsert the current local workspace. GUARDED so an empty
 *    local tree can never overwrite a populated cloud snapshot (which would
 *    wipe your maps on a device that hasn't pulled yet).
 */

const TABLE = "user_maps";
// The canvas registry is the source of truth for names, so the legacy
// `mapName` key is intentionally NOT synced (it's derived on rehydrate).
const META_KEYS = ["canvases", "activeCanvas", "bibleVersion"] as const;

type Canvas = { id: string; name: string };
type CloudSnapshot = {
  export: repo.HodosExport;
  meta: Record<string, unknown>;
};

async function localSnapshot(): Promise<CloudSnapshot> {
  const meta: Record<string, unknown> = {};
  for (const k of META_KEYS) {
    const v = await repo.getMeta(k);
    if (v !== undefined) meta[k] = v;
  }
  // exportForSync includes tombstones so deletions propagate across devices.
  return { export: await repo.exportForSync(), meta };
}

/**
 * Pull the cloud snapshot and merge it into local. Returns true if cloud data
 * was applied (so the caller can rehydrate the store).
 */
export async function pullCloud(userId: string): Promise<boolean> {
  const client = getBrowserClient();
  if (!client) return false;
  const { data, error } = await client
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.data?.export) return false;
  const snap = data.data as CloudSnapshot;
  try {
    await repo.importMerge(snap.export);
    // Union the canvas registry: keep every local canvas AND every cloud one;
    // cloud names win on a conflict.
    const localCanvases = (await repo.getMeta<Canvas[]>("canvases")) ?? [];
    const cloudCanvases = (snap.meta.canvases as Canvas[]) ?? [];
    const byId = new Map<string, Canvas>();
    for (const c of localCanvases) byId.set(c.id, c);
    for (const c of cloudCanvases) byId.set(c.id, c);
    const merged = [...byId.values()];
    if (merged.length) await repo.setMeta("canvases", merged);
    if (typeof snap.meta.activeCanvas === "string")
      await repo.setMeta("activeCanvas", snap.meta.activeCanvas);
    if (typeof snap.meta.bibleVersion === "string")
      await repo.setMeta("bibleVersion", snap.meta.bibleVersion);
    return true;
  } catch {
    return false;
  }
}

/** Upsert the full local workspace to the cloud. Best-effort; guarded. */
export async function pushCloud(userId: string): Promise<void> {
  const client = getBrowserClient();
  if (!client) return;
  const snap = await localSnapshot();
  // Safety: never let an empty local tree overwrite a populated cloud snapshot
  // (e.g. a device that signed in but hasn't pulled yet).
  if (snap.export.nodes.length === 0) {
    const { data } = await client
      .from(TABLE)
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    const cloudNodes = (data?.data as CloudSnapshot | undefined)?.export?.nodes;
    if (cloudNodes && cloudNodes.length > 0) return; // refuse the destructive push
  }
  const { error } = await client.from(TABLE).upsert(
    {
      user_id: userId,
      data: snap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.warn("[cloud-sync] push failed:", error.message);
}
