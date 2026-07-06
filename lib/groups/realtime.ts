import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase-browser";
import type { DbEdge, DbNode } from "@/lib/db/schema";

/**
 * Live group session over Supabase Realtime — the transport for a shared,
 * collaboratively-edited canvas. Three channels of information ride one
 * Supabase channel per group:
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

/** Open (or re-open) the realtime channel for a group. Returns false if off. */
export function openGroupChannel(
  groupId: string,
  me: GroupMemberMeta,
  handlers: Handlers,
): boolean {
  const client = getBrowserClient();
  if (!client) return false;
  closeGroupChannel();
  currentGroupId = groupId;

  const ch = client.channel(`group:${groupId}`, {
    config: { presence: { key: me.userId }, broadcast: { self: false } },
  });

  ch.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "group_nodes",
      filter: `group_id=eq.${groupId}`,
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
      filter: `group_id=eq.${groupId}`,
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
      map_id: n.mapId,
      data: n,
      updated_at: new Date(n.updatedAt).toISOString(),
      deleted_at: n.deletedAt ? new Date(n.deletedAt).toISOString() : null,
    })),
    ...delNodeIds.map((id) => ({
      id,
      group_id: groupId,
      map_id: groupId,
      data: {
        id,
        mapId: groupId,
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
      map_id: e.mapId,
      data: e,
      updated_at: new Date(e.updatedAt).toISOString(),
      deleted_at: e.deletedAt ? new Date(e.deletedAt).toISOString() : null,
    })),
    ...delEdgeIds.map((id) => ({
      id,
      group_id: groupId,
      map_id: groupId,
      data: {
        id,
        mapId: groupId,
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

/** Seed a fresh client with the whole current group canvas. */
export async function fetchGroupContent(
  groupId: string,
): Promise<{ nodes: DbNode[]; edges: DbEdge[] }> {
  const client = getBrowserClient();
  if (!client) return { nodes: [], edges: [] };
  const [nodesRes, edgesRes] = await Promise.all([
    client.from("group_nodes").select("*").eq("group_id", groupId),
    client.from("group_edges").select("*").eq("group_id", groupId),
  ]);
  const nodes = (nodesRes.data ?? []).map((r) =>
    rowToNode(r as Parameters<typeof rowToNode>[0]),
  );
  const edges = (edgesRes.data ?? []).map((r) =>
    rowToEdge(r as Parameters<typeof rowToEdge>[0]),
  );
  return { nodes, edges };
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

export async function listMyGroups(): Promise<GroupRow[]> {
  const client = getBrowserClient();
  if (!client) return [];
  const { data, error } = await client.rpc("my_groups");
  if (error) {
    console.error("hodos: my_groups failed", error);
    return [];
  }
  return (data ?? []) as GroupRow[];
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
