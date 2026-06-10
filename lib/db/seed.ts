import { uuidv7 } from "@/lib/uuid";
import { ROOT_MAP_ID, type DbEdge, type DbNode } from "./schema";

/**
 * First-visit onboarding map — the 3-bubble Melchizedek arc from the
 * landing-page hero, so the canvas immediately feels familiar.
 *
 * Verse text is Berean Standard Bible (public domain), verified word-for-word
 * against BibleHub on 2026-06-09. Do not edit without re-verifying.
 */
export function buildSeed(): { nodes: DbNode[]; edges: DbEdge[] } {
  const now = Date.now();
  const stamp = { createdAt: now, updatedAt: now, mapId: ROOT_MAP_ID };

  const question: DbNode = {
    id: uuidv7(),
    type: "question",
    content: "Who is Melchizedek?",
    position: { x: 360, y: 300 },
    ...stamp,
  };
  const genesis: DbNode = {
    id: uuidv7(),
    type: "verse",
    content: "",
    verseRef: "Genesis 14:18",
    verseText:
      "Then Melchizedek king of Salem brought out bread and wine—since he was priest of God Most High—",
    position: { x: 80, y: 60 },
    ...stamp,
  };
  const psalm: DbNode = {
    id: uuidv7(),
    type: "verse",
    content: "",
    verseRef: "Psalm 110:4",
    verseText:
      "The LORD has sworn and will not change His mind: “You are a priest forever in the order of Melchizedek.”",
    position: { x: 640, y: 60 },
    ...stamp,
  };

  const edges: DbEdge[] = [
    {
      id: uuidv7(),
      source: question.id,
      target: genesis.id,
      kind: "manual",
      ...stamp,
    },
    {
      id: uuidv7(),
      source: question.id,
      target: psalm.id,
      kind: "manual",
      ...stamp,
    },
  ];

  return { nodes: [question, genesis, psalm], edges };
}
