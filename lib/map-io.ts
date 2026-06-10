import { z } from "zod";
import type { HodosExport } from "@/lib/db/repo";

/** Export / import of .hodos.json files. */

const positionSchema = z.object({ x: z.number(), y: z.number() });

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["question", "verse", "note"]),
  content: z.string().default(""),
  verseRef: z.string().optional(),
  verseText: z.string().optional(),
  position: positionSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().optional(),
});

const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  kind: z.enum(["manual", "crossref"]),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().optional(),
});

export const exportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export function parseImport(text: string): HodosExport {
  const parsed = exportSchema.parse(JSON.parse(text));
  // Drop edges that reference missing nodes so an import can never corrupt
  const ids = new Set(parsed.nodes.map((n) => n.id));
  return {
    ...parsed,
    edges: parsed.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  };
}

export function downloadExport(data: HodosExport) {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hodos-map-${stamp}.hodos.json`;
  a.click();
  URL.revokeObjectURL(url);
}
