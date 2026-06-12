/**
 * Curated pronoun referents for the study panel.
 *
 * When a cross-referenced verse reads as a bare pronoun ("He met Abraham…"),
 * it's easy to lose track of who's being spoken about. This is a hand-authored
 * map from a verse reference to the person the verse's pronoun(s) point to, so
 * the panel can show a small clarifier — e.g. "He → Melchizedek".
 *
 * Coverage is intentionally limited (no AI here): the Melchizedek / eternal-
 * priesthood thread and a handful of well-known passages. Unknown verses show
 * no clarifier. The verse text itself is never altered — the note sits beside
 * it in parentheses.
 */

export const VERSE_REFERENTS: Record<string, string> = {
  // Genesis 14 — Melchizedek meets Abram
  "Genesis 14:18": "Melchizedek",
  "Genesis 14:19": "Melchizedek",
  "Genesis 14:20": "Abram",
  // Hebrews 7 — the order of Melchizedek
  "Hebrews 7:1": "Melchizedek",
  "Hebrews 7:2": "Melchizedek",
  "Hebrews 7:3": "Melchizedek",
  "Hebrews 7:4": "Melchizedek",
  "Hebrews 7:6": "Melchizedek",
  "Hebrews 7:7": "Melchizedek",
  "Hebrews 7:9": "Levi",
  "Hebrews 7:10": "Levi",
  "Hebrews 7:24": "Jesus",
  "Hebrews 7:25": "Jesus",
  "Hebrews 5:6": "Christ",
  "Hebrews 6:20": "Jesus",
  // John 1 — the Word
  "John 1:1": "the Word (Christ)",
  "John 1:2": "the Word (Christ)",
  "John 1:3": "the Word (Christ)",
  "John 1:10": "the Word (Christ)",
  "John 1:11": "the Word (Christ)",
};

const PRONOUN = /\b(he|him|his|she|her|hers|they|them|their|it|its)\b/i;

/**
 * A short clarifier for a verse whose subject is an unnamed pronoun, or null
 * when there's no curated referent, no pronoun, or the verse already names the
 * person (so we don't add a redundant note). Returns e.g.
 * `{ pronoun: "He", referent: "Melchizedek" }`.
 */
export function pronounClarifier(
  verseRef: string,
  text: string,
): { pronoun: string; referent: string } | null {
  const referent = VERSE_REFERENTS[verseRef];
  if (!referent) return null;

  // Skip if the verse already names the referent — the pronoun isn't ambiguous.
  const names = referent
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && w.toLowerCase() !== "the");
  if (names.some((n) => new RegExp(`\\b${n}\\b`, "i").test(text))) return null;

  const m = text.match(PRONOUN);
  if (!m) return null;
  const pronoun = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  return { pronoun, referent };
}
