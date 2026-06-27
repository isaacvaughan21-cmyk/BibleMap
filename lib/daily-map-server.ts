import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  type DailyMap,
  type DailyMapIndex,
  dayKey,
  pickForDate,
} from "@/lib/daily-map";

/**
 * Server-side access to the committed daily maps. Reads the same JSON the
 * client fetches, straight off the filesystem (mirroring lib/qa/server-bible's
 * approach), so the public page can render and emit link-preview metadata
 * without a network round-trip. The map files are traced into the deployed
 * function via outputFileTracingIncludes in next.config.mjs.
 */

const DIR = path.join(process.cwd(), "public", "daily-maps");

/**
 * Read the manifest fresh each call. It's small, and reading it live means a
 * newly published map (committed by the daily schedule) shows up without the
 * staleness a module-level cache would introduce in a long-running process.
 */
export async function loadDailyIndexServer(): Promise<DailyMapIndex> {
  const raw = await fs.readFile(path.join(DIR, "index.json"), "utf8");
  return JSON.parse(raw) as DailyMapIndex;
}

export async function loadDailyMapServer(id: string): Promise<DailyMap | null> {
  // Guard the id so it can never escape the directory.
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    const raw = await fs.readFile(path.join(DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as DailyMap;
  } catch {
    return null;
  }
}

/** Today's featured map (server), or null if none are published yet. */
export async function loadTodaysMapServer(
  todayKey: string = dayKey(),
): Promise<DailyMap | null> {
  let index: DailyMapIndex;
  try {
    index = await loadDailyIndexServer();
  } catch {
    return null;
  }
  const meta = pickForDate(index.maps, todayKey);
  if (!meta) return null;
  return loadDailyMapServer(meta.id);
}
