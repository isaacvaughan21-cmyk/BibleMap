import { test, expect } from "@playwright/test";
import {
  refLocation,
  scriptureLabel,
  shortBookName,
} from "@/lib/library/canon";
import {
  mergeEntries,
  normalizeCanvases,
  normalizeShelves,
  type CanvasEntry,
} from "@/lib/library/model";

/**
 * Pure-unit tests for the Library's two load-bearing derivations: the scripture
 * spine (what a study's verse bubbles say about which books it touches) and the
 * registry migration (reading a canvas list written by any earlier version, and
 * reconciling two devices' copies of it).
 *
 * Run: npx playwright test tests/library.spec.ts
 */

const chapters = (pairs: [string, number[]][]) =>
  new Map(pairs.map(([code, chs]) => [code, new Set(chs)]));

test.describe("scripture spine", () => {
  test("reads a book and its chapters off every reference the picker can write", () => {
    expect(refLocation("John 3:16")).toEqual({ code: "John", chapters: [3] });
    expect(refLocation("Hebrews 7:1–3")).toEqual({
      code: "Heb",
      chapters: [7],
    });
    // A span across chapters contributes every chapter it crosses.
    expect(refLocation("Luke 1:46–2:14")).toEqual({
      code: "Luke",
      chapters: [1, 2],
    });
    expect(refLocation("1 Corinthians 13:4")).toEqual({
      code: "1Cor",
      chapters: [13],
    });
  });

  test("shrugs off anything it can't parse rather than throwing", () => {
    expect(refLocation(undefined)).toBeNull();
    expect(refLocation("")).toBeNull();
    expect(refLocation("a note the reader typed")).toBeNull();
  });

  test("labels books in canon order, not the order they were placed", () => {
    const label = scriptureLabel(
      chapters([
        ["Heb", [5, 6, 7]],
        ["Ps", [110]],
        ["Gen", [14]],
      ]),
    );
    expect(label).toBe("Gen 14 · Ps 110 · Heb 5–7");
  });

  test("collapses runs of chapters and counts the overflow", () => {
    expect(scriptureLabel(chapters([["Isa", [7, 9]]]))).toBe("Isa 7, 9");
    expect(scriptureLabel(chapters([["Rom", [1, 2, 3, 8]]]))).toBe(
      "Rom 1–3, 8",
    );
    // More than two groups would crowd the card, so it trails off instead.
    expect(scriptureLabel(chapters([["Ps", [1, 5, 9]]]))).toBe("Ps 1, 5…");
    const many = scriptureLabel(
      chapters([
        ["Gen", [1]],
        ["Ps", [1]],
        ["Isa", [1]],
        ["John", [1]],
        ["Rom", [1]],
      ]),
    );
    expect(many).toBe("Gen 1 · Ps 1 · Isa 1 +2 more");
  });

  test("is empty for a study that has placed no verse yet", () => {
    expect(scriptureLabel(new Map())).toBe("");
  });

  test("spaces out numbered books so a card stays readable", () => {
    expect(shortBookName("1Cor")).toBe("1 Cor");
    expect(shortBookName("2Kgs")).toBe("2 Kgs");
    expect(shortBookName("Heb")).toBe("Heb");
  });
});

test.describe("registry migration", () => {
  const fallback = { id: "root", name: "Untitled map" };

  test("widens rows written before the Library existed", () => {
    const [entry] = normalizeCanvases(
      [{ id: "root", name: "Melchizedek" }],
      fallback,
      1000,
    );
    expect(entry).toMatchObject({
      id: "root",
      name: "Melchizedek",
      createdAt: 1000,
      openedAt: 1000,
      updatedAt: 1000,
    });
    expect(entry.shelfId).toBeUndefined();
  });

  test("never leaves a reader with an empty library", () => {
    for (const bad of [null, undefined, [], "canvases", 7, [{}, { id: 3 }]]) {
      const rows = normalizeCanvases(bad, fallback, 1000);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].id).toBe("root");
    }
  });

  test("drops duplicate ids and keeps the first", () => {
    const rows = normalizeCanvases(
      [
        { id: "a", name: "First" },
        { id: "a", name: "Second" },
        { id: "b", name: "Other" },
      ],
      fallback,
      1000,
    );
    expect(rows.map((r) => r.name)).toEqual(["First", "Other"]);
  });

  test("keeps organisation, and caps tags", () => {
    const [entry] = normalizeCanvases(
      [
        {
          id: "a",
          name: "Romans 8",
          createdAt: 1,
          openedAt: 2,
          updatedAt: 3,
          shelfId: "sh",
          tags: ["a", "b", "c", "d", "e", "f", "g", "h"],
          pinned: true,
          archivedAt: 9,
          seriesIndex: 8,
        },
      ],
      fallback,
      1000,
    );
    expect(entry.tags).toHaveLength(6);
    expect(entry).toMatchObject({
      shelfId: "sh",
      pinned: true,
      archivedAt: 9,
      seriesIndex: 8,
    });
  });

  test("shelves survive a round trip and sort by their stored order", () => {
    const shelves = normalizeShelves([
      { id: "b", name: "Second", order: 2 },
      { id: "a", name: "First", order: 1, sequential: true },
      { id: "junk" },
      null,
    ]);
    expect(shelves.map((s) => s.id)).toEqual(["a", "b"]);
    expect(shelves[0].sequential).toBe(true);
  });
});

test.describe("two devices", () => {
  const base: CanvasEntry = {
    id: "a",
    name: "Melchizedek",
    createdAt: 100,
    openedAt: 100,
    updatedAt: 100,
  };

  test("the more recently organised copy wins", () => {
    const shelved = { ...base, shelfId: "sh-heb", updatedAt: 500 };
    const merged = mergeEntries(base, shelved);
    expect(merged.shelfId).toBe("sh-heb");
    // …in either argument order.
    expect(mergeEntries(shelved, base).shelfId).toBe("sh-heb");
  });

  test("merely opening a study on one device can't undo shelving on another", () => {
    // The phone opened it (openedAt moves, updatedAt doesn't); the laptop
    // shelved it. Both facts should survive.
    const phone = { ...base, openedAt: 900 };
    const laptop = { ...base, shelfId: "sh-heb", updatedAt: 500 };
    const merged = mergeEntries(phone, laptop);
    expect(merged.shelfId).toBe("sh-heb");
    expect(merged.openedAt).toBe(900);
  });

  test("birth and recency take the most generous value from either side", () => {
    const older = { ...base, createdAt: 10, openedAt: 20, updatedAt: 700 };
    const merged = mergeEntries(older, { ...base, openedAt: 800 });
    expect(merged.createdAt).toBe(10);
    expect(merged.openedAt).toBe(800);
    expect(merged.updatedAt).toBe(700);
  });

  test("a side with no tags doesn't erase the side that has them", () => {
    const tagged = { ...base, tags: ["sermon"] };
    const renamed = {
      ...base,
      name: "Melchizedek — who is he?",
      updatedAt: 900,
    };
    expect(mergeEntries(tagged, renamed)).toMatchObject({
      name: "Melchizedek — who is he?",
      tags: ["sermon"],
    });
  });
});
