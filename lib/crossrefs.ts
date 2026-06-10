import { fromOsisId, osisId, type ParsedRef } from "./bible";

/**
 * Treasury of Scripture Knowledge cross-references (OpenBible.info's
 * TSK-derived dataset, CC-BY). One keyed lookup at /tsk.json, loaded once.
 */

export type CrossRef = {
  /** start of the target passage */
  target: ParsedRef;
  /** end verse when the reference is a range, else undefined */
  targetEnd?: ParsedRef;
};

let tskPromise: Promise<Record<string, string[]>> | null = null;

export function loadTsk(): Promise<Record<string, string[]>> {
  if (!tskPromise) {
    tskPromise = fetch("/tsk.json").then((res) => {
      if (!res.ok)
        throw new Error(`Failed to load cross-references (${res.status})`);
      return res.json();
    });
    tskPromise.catch(() => {
      tskPromise = null; // retry-able
    });
  }
  return tskPromise;
}

/** Cross references for a verse, ordered by classical weight. */
export async function getCrossRefs(ref: ParsedRef): Promise<CrossRef[]> {
  const tsk = await loadTsk();
  const targets = tsk[osisId(ref)] ?? [];
  const out: CrossRef[] = [];
  for (const t of targets) {
    const [startId, endId] = t.split("-");
    const target = fromOsisId(startId);
    if (!target) continue;
    const targetEnd = endId ? (fromOsisId(endId) ?? undefined) : undefined;
    out.push({ target, targetEnd });
  }
  return out;
}

export function formatCrossRef(r: CrossRef): string {
  const base = `${r.target.book.name} ${r.target.chapter}:${r.target.verse}`;
  if (!r.targetEnd) return base;
  if (
    r.targetEnd.book.code === r.target.book.code &&
    r.targetEnd.chapter === r.target.chapter
  ) {
    return `${base}–${r.targetEnd.verse}`;
  }
  return `${base}–${r.targetEnd.chapter}:${r.targetEnd.verse}`;
}
