import * as repo from "@/lib/db/repo";
import { ROOT_MAP_ID, type DbEdge, type DbNode } from "@/lib/db/schema";
import { uuidv7 } from "@/lib/uuid";
import type { DailyMap } from "@/lib/daily-map";

// Mirrors DEFAULT_MAP_NAME in the canvas store — inlined to avoid pulling the
// whole store (zustand + Dexie wiring) into this lightweight helper.
const DEFAULT_MAP_NAME = "Untitled map";

/**
 * Copy a daily map into the reader's own library as a fresh, fully editable
 * canvas — the "Save to my canvas" action. Runs client-side only (it writes to
 * IndexedDB via the repo).
 *
 * Every node and edge gets a brand-new id under a brand-new map id, so the copy
 * is independent of the source and can never collide with anything already in
 * the reader's database. Verse text is carried verbatim from the (corpus-
 * validated) map, so the saved copy is offline-ready immediately.
 *
 * Node order is preserved and stamped into createdAt so the first node (the
 * centring question) sorts earliest — making it the canvas's emphasised anchor
 * (see usePrimaryNodeId).
 */
export async function importDailyMapAsCanvas(
  map: DailyMap,
  opts: { activate?: boolean } = {},
): Promise<string> {
  const canvasId = uuidv7();
  const now = Date.now();

  // Map each source node id to a fresh id, so edges can be rewired.
  const idMap = new Map<string, string>();
  for (const n of map.nodes) idMap.set(n.id, uuidv7());

  const dbNodes: DbNode[] = map.nodes.map((n, i) => {
    const isVerse = n.type === "verse";
    return {
      id: idMap.get(n.id) as string,
      mapId: canvasId,
      type: n.type,
      content: isVerse ? "" : (n.content ?? ""),
      verseRef: isVerse ? n.verseRef : undefined,
      verseText: isVerse ? n.verseText : undefined,
      position: { x: n.position.x, y: n.position.y },
      createdAt: now + i,
      updatedAt: now + i,
    };
  });

  const dbEdges: DbEdge[] = map.edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e, i) => ({
      id: uuidv7(),
      mapId: canvasId,
      source: idMap.get(e.source) as string,
      target: idMap.get(e.target) as string,
      kind: e.kind,
      createdAt: now + i,
      updatedAt: now + i,
    }));

  await repo.upsertNodes(dbNodes);
  await repo.upsertEdges(dbEdges);

  // Register the new canvas in the canvas list (creating the list if this is a
  // brand-new visitor whose database has only the implicit root).
  const canvases = (await repo.getMeta<{ id: string; name: string }[]>(
    "canvases",
  )) ?? [
    {
      id: ROOT_MAP_ID,
      name: (await repo.getMeta<string>("mapName")) ?? DEFAULT_MAP_NAME,
    },
  ];
  const name = map.title?.trim().slice(0, 120) || "Map of the Day";
  await repo.setMeta("canvases", [...canvases, { id: canvasId, name }]);

  // From the public page we want the app to open straight onto the new canvas;
  // from inside the app the caller animates the slide itself, so it stays put.
  if (opts.activate) await repo.setMeta("activeCanvas", canvasId);

  return canvasId;
}
