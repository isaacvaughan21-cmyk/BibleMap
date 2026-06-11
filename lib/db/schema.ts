import Dexie, { type EntityTable } from "dexie";
import type { EdgeKind, NodeKind } from "@/lib/types";

/**
 * Hodos local-first persistence — IndexedDB via Dexie.
 *
 * The v1 schema was locked during the build. v2 adds `mapId` to support
 * nested maps ("open a bubble into a whole map of its own"). The migration
 * backfills every existing row to the root map, so no data is lost.
 *
 * ROOT_MAP_ID is the top-level canvas. A child map's id IS the id of the
 * bubble that was opened to reveal it — so nesting needs no separate registry.
 */

export const ROOT_MAP_ID = "root";

export interface DbNode {
  id: string; // uuid v7
  mapId: string; // which map this bubble lives on (ROOT_MAP_ID for the top)
  type: NodeKind;
  content: string;
  verseRef?: string; // 'JHN 3:16' osis-like
  verseText?: string; // denormalized for offline
  position: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // soft delete
}

export interface DbEdge {
  id: string; // uuid v7
  mapId: string; // which map this connection lives on
  source: string; // node id
  target: string; // node id
  kind: EdgeKind;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface DbMeta {
  key: string;
  value: unknown;
}

export const db = new Dexie("hodos") as Dexie & {
  nodes: EntityTable<DbNode, "id">;
  edges: EntityTable<DbEdge, "id">;
  meta: EntityTable<DbMeta, "key">;
};

db.version(1).stores({
  nodes: "id, updatedAt",
  edges: "id, source, target",
  meta: "key",
});

// v2 — nested maps. Index mapId; backfill existing rows to the root map.
db.version(2)
  .stores({
    nodes: "id, updatedAt, mapId",
    edges: "id, source, target, mapId",
    meta: "key",
  })
  .upgrade(async (tx) => {
    await tx
      .table("nodes")
      .toCollection()
      .modify((n: DbNode) => {
        if (!n.mapId) n.mapId = ROOT_MAP_ID;
      });
    await tx
      .table("edges")
      .toCollection()
      .modify((e: DbEdge) => {
        if (!e.mapId) e.mapId = ROOT_MAP_ID;
      });
  });
