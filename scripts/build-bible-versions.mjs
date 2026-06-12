/**
 * Fetch public-domain Bible versions (KJV, WEB, ASV, YLT) from getBible.net v2
 * and write them in the same shape as the bundled BSB:
 *   public/bible/<VERSION>/<Code>.json = { code, name, chapters: string[][] }
 *
 * BSB stays at public/bible/<Code>.json (version "BSB"). Run once:
 *   node scripts/build-bible-versions.mjs
 *
 * Source: https://api.getbible.net/v2/<trans>/<bookNr>.json  (bookNr 1..66,
 * canonical Protestant order, matching lib/bible-books.ts).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "bible");

// Canonical order — index+1 === getBible book number. Mirrors lib/bible-books.ts.
const BOOKS = [
  ["Gen", "Genesis"],
  ["Exod", "Exodus"],
  ["Lev", "Leviticus"],
  ["Num", "Numbers"],
  ["Deut", "Deuteronomy"],
  ["Josh", "Joshua"],
  ["Judg", "Judges"],
  ["Ruth", "Ruth"],
  ["1Sam", "1 Samuel"],
  ["2Sam", "2 Samuel"],
  ["1Kgs", "1 Kings"],
  ["2Kgs", "2 Kings"],
  ["1Chr", "1 Chronicles"],
  ["2Chr", "2 Chronicles"],
  ["Ezra", "Ezra"],
  ["Neh", "Nehemiah"],
  ["Esth", "Esther"],
  ["Job", "Job"],
  ["Ps", "Psalm"],
  ["Prov", "Proverbs"],
  ["Eccl", "Ecclesiastes"],
  ["Song", "Song of Solomon"],
  ["Isa", "Isaiah"],
  ["Jer", "Jeremiah"],
  ["Lam", "Lamentations"],
  ["Ezek", "Ezekiel"],
  ["Dan", "Daniel"],
  ["Hos", "Hosea"],
  ["Joel", "Joel"],
  ["Amos", "Amos"],
  ["Obad", "Obadiah"],
  ["Jonah", "Jonah"],
  ["Mic", "Micah"],
  ["Nah", "Nahum"],
  ["Hab", "Habakkuk"],
  ["Zeph", "Zephaniah"],
  ["Hag", "Haggai"],
  ["Zech", "Zechariah"],
  ["Mal", "Malachi"],
  ["Matt", "Matthew"],
  ["Mark", "Mark"],
  ["Luke", "Luke"],
  ["John", "John"],
  ["Acts", "Acts"],
  ["Rom", "Romans"],
  ["1Cor", "1 Corinthians"],
  ["2Cor", "2 Corinthians"],
  ["Gal", "Galatians"],
  ["Eph", "Ephesians"],
  ["Phil", "Philippians"],
  ["Col", "Colossians"],
  ["1Thess", "1 Thessalonians"],
  ["2Thess", "2 Thessalonians"],
  ["1Tim", "1 Timothy"],
  ["2Tim", "2 Timothy"],
  ["Titus", "Titus"],
  ["Phlm", "Philemon"],
  ["Heb", "Hebrews"],
  ["Jas", "James"],
  ["1Pet", "1 Peter"],
  ["2Pet", "2 Peter"],
  ["1John", "1 John"],
  ["2John", "2 John"],
  ["3John", "3 John"],
  ["Jude", "Jude"],
  ["Rev", "Revelation"],
];

const VERSIONS = [
  ["KJV", "kjv"],
  ["WEB", "web"],
  ["ASV", "asv"],
  ["YLT", "ylt"],
];

/** Strip stray markup/footnote artifacts; keep the verse text clean. */
function clean(s) {
  return String(s)
    .replace(/<[^>]+>/g, "") // any HTML tags
    .replace(/\[[^\]]*\]/g, "") // [footnote] brackets
    .replace(/[¶†*]/g, "") // pilcrows / daggers
    .replace(/\s+/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

async function fetchBook(trans, nr, tries = 3) {
  const url = `https://api.getbible.net/v2/${trans}/${nr}.json`;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
}

let totalVerses = 0;
for (const [vcode, trans] of VERSIONS) {
  const dir = join(OUT, vcode);
  mkdirSync(dir, { recursive: true });
  let vVerses = 0;
  for (let nr = 1; nr <= 66; nr++) {
    const [code, name] = BOOKS[nr - 1];
    const data = await fetchBook(trans, nr);
    // getBible: { chapters: [ { chapter, verses: [ { verse, text } ] } ] }
    const chapters = (data.chapters ?? []).map((ch) => {
      const arr = [];
      for (const v of ch.verses ?? []) {
        arr[Number(v.verse) - 1] = clean(v.text);
      }
      // fill any gaps so indexes line up
      for (let i = 0; i < arr.length; i++) if (arr[i] == null) arr[i] = "";
      return arr;
    });
    vVerses += chapters.reduce((n, ch) => n + ch.length, 0);
    writeFileSync(
      join(dir, `${code}.json`),
      JSON.stringify({ code, name, chapters }),
    );
  }
  totalVerses += vVerses;
  console.log(`${vcode}: 66 books, ${vVerses} verses`);
}
console.log(
  `done — ${totalVerses} verses across ${VERSIONS.length} versions → public/bible/<VERSION>/`,
);
