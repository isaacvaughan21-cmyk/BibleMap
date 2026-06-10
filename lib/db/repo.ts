import { db, ROOT_MAP_ID, type DbEdge, type DbNode } from "./schema";

/** CRUD over the schema. All deletes are soft (deletedAt). Scoped per map. */

/** Live nodes + edges for a single map. */
export async function loadLive(
  mapId: string = ROOT_MAP_ID,
): Promise<{ nodes: DbNode[]; edges: DbEdge[] }> {
  const [nodes, edges] = await Promise.all([
    db.nodes.where("mapId").equals(mapId).toArray(),
    db.edges.where("mapId").equals(mapId).toArray(),
  ]);
  return {
    nodes: nodes.filter((n) => !n.deletedAt),
    edges: edges.filter((e) => !e.deletedAt),
  };
}

/** Live nodes + edges across every map — for export and snapshots. */
export async function loadAll(): Promise<{
  nodes: DbNode[];
  edges: DbEdge[];
}> {
  const [nodes, edges] = await Promise.all([
    db.nodes.toArray(),
    db.edges.toArray(),
  ]);
  return {
    nodes: nodes.filter((n) => !n.deletedAt),
    edges: edges.filter((e) => !e.deletedAt),
  };
}

/**
 * Of the given bubble ids, which already contain a non-empty child map?
 * A child map's id equals the parent bubble's id.
 */
export async function childMapIds(nodeIds: string[]): Promise<Set<string>> {
  if (!nodeIds.length) return new Set();
  const rows = await db.nodes.where("mapId").anyOf(nodeIds).toArray();
  const out = new Set<string>();
  for (const r of rows) if (!r.deletedAt) out.add(r.mapId);
  return out;
}

export const upsertNodes = (rows: DbNode[]) => db.nodes.bulkPut(rows);
export const upsertEdges = (rows: DbEdge[]) => db.edges.bulkPut(rows);

export async function softDeleteNodes(ids: string[]) {
  const now = Date.now();
  await Promise.all(
    ids.map((id) => db.nodes.update(id, { deletedAt: now, updatedAt: now })),
  );
}

export async function softDeleteEdges(ids: string[]) {
  const now = Date.now();
  await Promise.all(
    ids.map((id) => db.edges.update(id, { deletedAt: now, updatedAt: now })),
  );
}

export async function getMeta<T = unknown>(
  key: string,
): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export const setMeta = (key: string, value: unknown) =>
  db.meta.put({ key, value });

/** Full live dataset across all maps, for export and snapshots. */
export async function exportData() {
  const { nodes, edges } = await loadAll();
  const name = await getMeta<string>("mapName");
  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    name,
    nodes,
    edges,
  };
}

export type HodosExport = Awaited<ReturnType<typeof exportData>>;

/** Replace everything with an imported dataset (hard reset of the tables). */
export async function importReplace(data: HodosExport) {
  await db.transaction("rw", db.nodes, db.edges, async () => {
    await db.nodes.clear();
    await db.edges.clear();
    await db.nodes.bulkPut(data.nodes);
    await db.edges.bulkPut(data.edges);
  });
}

/** Merge an imported dataset — newer updatedAt wins per record. */
export async function importMerge(data: HodosExport) {
  await db.transaction("rw", db.nodes, db.edges, async () => {
    for (const n of data.nodes) {
      const existing = await db.nodes.get(n.id);
      if (!existing || existing.updatedAt < n.updatedAt) await db.nodes.put(n);
    }
    for (const e of data.edges) {
      const existing = await db.edges.get(e.id);
      if (!existing || existing.updatedAt < e.updatedAt) await db.edges.put(e);
    }
  });
}
