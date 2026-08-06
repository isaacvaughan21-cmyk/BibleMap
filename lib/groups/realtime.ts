import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase-browser";
import type { DbEdge, DbNode } from "@/lib/db/schema";

/**
 * Live group session over Supabase Realtime — the transport for a shared,
 * collaboratively-edited canvas. A group shares MANY canvases; the live
 * session is per-canvas (you're only ever standing in one study at a time),
 * so one Supabase channel per group+canvas carries three kinds of traffic:
 *
 *   1. postgres_changes on group_nodes / group_edges — the DURABLE path. Every
 *      member's flush upserts rows here; everyone else receives them and
 *      merges by last-write-wins. Survives reconnects and late joiners (a fresh
 *      client seeds from `fetchGroupContent`, then keeps up via these events).
 *   2. presence — the "who's here" roster.
 *   3. broadcast "cursor" — high-frequency cursor positions (never hits the DB).
 *
 * Everything degrades to a no-op when the browser Supabase client isn't
 * configured, so the app stays fully local-first until an anon key is present.
 */

export type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  role?: string;
  owner?: string;
  member_count?: number;
  canvas_count?: number;
};

/** One study a group shares. `id` is the canvas id, identical on every member. */
export type GroupCanvasRow = {
  id: string;
  group_id: string;
  name: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
};

export type GroupMemberMeta = {
  userId: string;
  name: string;
  color: string;
};

export type RemoteCursor = {
  userId: string;
  name: string;
  color: string;
  x: number; // flow coordinates
  y: number;
};

/** Who is currently editing a given bubble (an exclusive edit lock). */
export type EditLock = {
  nodeId: string;
  userId: string;
  name: string;
  color: string;
};

type Handlers = {
  /** Inbound rows to merge (LWW). Tombstones carry a `deletedAt`. */
  onRows: (nodes: DbNode[], edges: DbEdge[]) => void;
  /** The current online roster (deduped by userId). */
  onPresence: (members: GroupMemberMeta[]) => void;
  /** A peer moved their cursor. */
  onCursor: (cursor: RemoteCursor) => void;
  /** A peer started (editing:true) or stopped (editing:false) editing a bubble. */
  onLock: (lock: EditLock & { editing: boolean }) => void;
};

let channel: RealtimeChannel | null = null;
let currentGroupId: string | null = null;
/** Standing subscription to the canvas LISTS of every group I'm in. */
let listChannel: RealtimeChannel | null = null;

/** A stable, pleasant colour for a member, derived from their user id. */
export function colorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++)
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue} 62% 45%)`;
}

/** Reconstruct a DbNode/DbEdge from a group row payload (data + tombstone). */
function rowToNode(row: {
  id: string;
  map_id: string;
  data: DbNode | null;
  updated_at: string;
  deleted_at: string | null;
}): DbNode {
  const base: DbNode =
    (row.data as DbNode) ??
    ({
      id: row.id,
      mapId: row.map_id,
      type: "note",
      content: "",
      position: { x: 0, y: 0 },
      createdAt: 0,
      updatedAt: 0,
    } as DbNode);
  return {
    ...base,
    id: row.id,
    mapId: row.map_id,
    updatedAt: base.updatedAt || Date.parse(row.updated_at) || Date.now(),
    deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : base.deletedAt,
  };
}

function rowToEdge(row: {
  id: string;
  map_id: string;
  data: DbEdge | null;
  updated_at: string;
  deleted_at: string | null;
}): DbEdge {
  const base: DbEdge =
    (row.data as DbEdge) ??
    ({
      id: row.id,
      mapId: row.map_id,
      source: "",
      target: "",
      kind: "manual",
      createdAt: 0,
      updatedAt: 0,
    } as DbEdge);
  return {
    ...base,
    id: row.id,
    mapId: row.map_id,
    updatedAt: base.updatedAt || Date.parse(row.updated_at) || Date.now(),
    deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : base.deletedAt,
  };
}

/**
 * Open (or re-open) the realtime channel for ONE shared canvas of a group.
 * Presence is per-canvas too: the roster answers "who else is in this study",
 * not "who is in this group". Returns false if the cloud isn't configured.
 */
export function openGroupChannel(
  groupId: string,
  canvasId: string,
  me: GroupMemberMeta,
  handlers: Handlers,
): boolean {
  const client = getBrowserClient();
  if (!client) return false;
  closeGroupChannel();
  currentGroupId = groupId;

  const ch = client.channel(`group:${groupId}:canvas:${canvasId}`, {
    config: { presence: { key: me.userId }, broadcast: { self: false } },
  });

  ch.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "group_nodes",
      filter: `canvas_id=eq.${canvasId}`,
    },
    (payload) => {
      const row = payload.new as Parameters<typeof rowToNode>[0];
      if (row?.id) handlers.onRows([rowToNode(row)], []);
    },
  );
  ch.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "group_edges",
      filter: `canvas_id=eq.${canvasId}`,
    },
    (payload) => {
      const row = payload.new as Parameters<typeof rowToEdge>[0];
      if (row?.id) handlers.onRows([], [rowToEdge(row)]);
    },
  );

  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<GroupMemberMeta>();
    const seen = new Map<string, GroupMemberMeta>();
    for (const entries of Object.values(state)) {
      for (const e of entries) {
        if (e?.userId)
          seen.set(e.userId, {
            userId: e.userId,
            name: e.name,
            color: e.color,
          });
      }
    }
    handlers.onPresence([...seen.values()]);
  });

  ch.on("broadcast", { event: "cursor" }, ({ payload }) => {
    const c = payload as RemoteCursor;
    if (c?.userId && c.userId !== me.userId) handlers.onCursor(c);
  });

  ch.on("broadcast", { event: "lock" }, ({ payload }) => {
    const l = payload as EditLock & { editing: boolean };
    if (l?.nodeId && l.userId !== me.userId) handlers.onLock(l);
  });

  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void ch.track(me);
    }
  });

  channel = ch;
  return true;
}

export function closeGroupChannel(): void {
  if (channel) {
    const client = getBrowserClient();
    void client?.removeChannel(channel);
  }
  channel = null;
  currentGroupId = null;
}

/** Throttled cursor broadcast (position in flow coordinates). */
export function broadcastCursor(cursor: RemoteCursor): void {
  if (!channel) return;
  void channel.send({ type: "broadcast", event: "cursor", payload: cursor });
}

/** Announce that this member started or stopped editing a bubble. */
export function broadcastLock(payload: EditLock & { editing: boolean }): void {
  if (!channel) return;
  void channel.send({ type: "broadcast", event: "lock", payload });
}

/**
 * Mirror a flush to the group tables. `delNodeIds` / `delEdgeIds` become
 * soft-delete tombstones. Best-effort — a failed push never blocks local save.
 */
export async function pushGroupRows(
  groupId: string,
  canvasId: string,
  nodeRows: DbNode[],
  edgeRows: DbEdge[],
  delNodeIds: string[],
  delEdgeIds: string[],
): Promise<void> {
  const client = getBrowserClient();
  if (!client) return;
  const nowIso = new Date().toISOString();

  const nodePayload = [
    ...nodeRows.map((n) => ({
      id: n.id,
      group_id: groupId,
      canvas_id: canvasId,
      map_id: n.mapId,
      data: n,
      updated_at: new Date(n.updatedAt).toISOString(),
      deleted_at: n.deletedAt ? new Date(n.deletedAt).toISOString() : null,
    })),
    ...delNodeIds.map((id) => ({
      id,
      group_id: groupId,
      canvas_id: canvasId,
      map_id: canvasId,
      data: {
        id,
        mapId: canvasId,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      },
      updated_at: nowIso,
      deleted_at: nowIso,
    })),
  ];
  const edgePayload = [
    ...edgeRows.map((e) => ({
      id: e.id,
      group_id: groupId,
      canvas_id: canvasId,
      map_id: e.mapId,
      data: e,
      updated_at: new Date(e.updatedAt).toISOString(),
      deleted_at: e.deletedAt ? new Date(e.deletedAt).toISOString() : null,
    })),
    ...delEdgeIds.map((id) => ({
      id,
      group_id: groupId,
      canvas_id: canvasId,
      map_id: canvasId,
      data: {
        id,
        mapId: canvasId,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      },
      updated_at: nowIso,
      deleted_at: nowIso,
    })),
  ];

  try {
    await Promise.all([
      nodePayload.length
        ? client.from("group_nodes").upsert(nodePayload, { onConflict: "id" })
        : null,
      edgePayload.length
        ? client.from("group_edges").upsert(edgePayload, { onConflict: "id" })
        : null,
    ]);
  } catch (err) {
    console.error("hodos: group push failed", err);
  }
}

/** Seed a fresh client with one whole shared canvas. */
export async function fetchGroupContent(
  canvasId: string,
): Promise<{ nodes: DbNode[]; edges: DbEdge[] }> {
  const client = getBrowserClient();
  if (!client) return { nodes: [], edges: [] };
  const [nodesRes, edgesRes] = await Promise.all([
    client.from("group_nodes").select("*").eq("canvas_id", canvasId),
    client.from("group_edges").select("*").eq("canvas_id", canvasId),
  ]);
  const nodes = (nodesRes.data ?? []).map((r) =>
    rowToNode(r as Parameters<typeof rowToNode>[0]),
  );
  const edges = (edgesRes.data ?? []).map((r) =>
    rowToEdge(r as Parameters<typeof rowToEdge>[0]),
  );
  return { nodes, edges };
}

/* ── The canvases a group shares ─────────────────────────────────────────── */

/**
 * Every shared study across every group I'm in — RLS does the filtering, so
 * one round trip fills the whole "My groups" section of the Library.
 *
 * Returns null (not an empty list) when the fetch fails: callers reconcile
 * their local registry against this, and "we couldn't ask" must never be
 * mistaken for "everything has been unshared".
 */
export async function listGroupCanvases(): Promise<GroupCanvasRow[] | null> {
  const client = getBrowserClient();
  if (!client) return null;
  const { data, error } = await client
    .from("group_canvases")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("hodos: group_canvases list failed", error);
    return null;
  }
  return (data ?? []) as GroupCanvasRow[];
}

/**
 * Put a canvas on a group's shelf. Idempotent on the canvas id, so re-sharing
 * a study already in the group is a no-op rather than an error.
 */
export async function shareCanvasRow(
  groupId: string,
  canvasId: string,
  name: string,
): Promise<GroupCanvasRow | null> {
  const client = getBrowserClient();
  if (!client) return null;
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await client
    .from("group_canvases")
    .upsert(
      {
        id: canvasId,
        group_id: groupId,
        name,
        created_by: uid,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  if (error) {
    console.error("hodos: share canvas failed", error);
    return null;
  }
  return data as GroupCanvasRow;
}

/** Keep a shared study's name in step with the local rename. */
export async function renameGroupCanvasRow(
  canvasId: string,
  name: string,
): Promise<void> {
  const client = getBrowserClient();
  if (!client) return;
  await client
    .from("group_canvases")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", canvasId);
}

/**
 * Take a study back out of a group — the listing AND its mirrored content, so
 * nothing lingers server-side for members who hadn't opened it yet.
 */
export async function unshareCanvasRow(canvasId: string): Promise<void> {
  const client = getBrowserClient();
  if (!client) return;
  const { error } = await client
    .from("group_canvases")
    .delete()
    .eq("id", canvasId);
  if (error) {
    console.error("hodos: unshare failed", error);
    return;
  }
  await Promise.all([
    client.from("group_nodes").delete().eq("canvas_id", canvasId),
    client.from("group_edges").delete().eq("canvas_id", canvasId),
  ]);
}

/**
 * Watch the shared-study lists of every group I'm in, so a study a member
 * shares appears in my Library without a reload. Separate from the per-canvas
 * session channel: this one stands for as long as the app is open.
 */
export function subscribeGroupCanvases(onChange: () => void): void {
  const client = getBrowserClient();
  if (!client) return;
  unsubscribeGroupCanvases();
  const ch = client.channel("group-canvases");
  ch.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "group_canvases" },
    () => onChange(),
  );
  ch.subscribe();
  listChannel = ch;
}

export function unsubscribeGroupCanvases(): void {
  if (listChannel) {
    const client = getBrowserClient();
    void client?.removeChannel(listChannel);
  }
  listChannel = null;
}

/* ── Membership RPCs ─────────────────────────────────────────────────────── */

export async function createGroup(
  name: string,
  displayName: string,
): Promise<GroupRow | null> {
  const client = getBrowserClient();
  if (!client) return null;
  const { data, error } = await client.rpc("create_group", {
    p_name: name,
    p_display_name: displayName,
  });
  if (error) {
    console.error("hodos: create_group failed", error);
    return null;
  }
  return data as GroupRow;
}

export async function joinGroupByCode(
  code: string,
  displayName: string,
): Promise<{ group: GroupRow | null; error: string | null }> {
  const client = getBrowserClient();
  if (!client) return { group: null, error: "Cloud isn't enabled." };
  const { data, error } = await client.rpc("join_group_by_code", {
    p_code: code,
    p_display_name: displayName,
  });
  if (error) return { group: null, error: error.message };
  return { group: data as GroupRow, error: null };
}

/** Null on failure — see `listGroupCanvases` for why that matters. */
export async function listMyGroups(): Promise<GroupRow[] | null> {
  const client = getBrowserClient();
  if (!client) return null;
  const { data, error } = await client.rpc("my_groups");
  if (error) {
    console.error("hodos: my_groups failed", error);
    return null;
  }
  return (data ?? []) as GroupRow[];
}

/** Rename a group. Any member may — the name is the room's, not the founder's. */
export async function renameGroupRpc(
  groupId: string,
  name: string,
): Promise<boolean> {
  const client = getBrowserClient();
  if (!client) return false;
  const { error } = await client.rpc("rename_group", {
    p_group_id: groupId,
    p_name: name,
  });
  if (error) {
    console.error("hodos: rename_group failed", error);
    return false;
  }
  return true;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const client = getBrowserClient();
  if (!client) return;
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await client
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", uid);
  if (currentGroupId === groupId) closeGroupChannel();
}
