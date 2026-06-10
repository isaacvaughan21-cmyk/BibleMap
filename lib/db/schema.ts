import Dexie, { type EntityTable } from "dexie";
import type { EdgeKind, NodeKind } from "@/lib/types";

/**
 * Hodos local-first persistence — IndexedDB via Dexie.
 * SCHEMA IS LOCKED (build brief, Phase 2 Week 3). Do not add or change fields.
 */

export interface DbNode {
  id: string; // uuid v7
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
