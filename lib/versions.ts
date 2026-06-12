/**
 * Bible translations available in Hodos.
 *
 * Only public-domain / freely-licensed versions can be bundled with full text.
 * The popular copyrighted ones (NIV, ESV, NLT, NASB…) can't be redistributed
 * without a paid license, so they're offered as a "request" that routes to the
 * feedback form instead.
 */

export type BibleVersion = {
  /** Storage code; also the folder under public/bible/ (BSB lives at the root). */
  code: string;
  name: string;
};

export const DEFAULT_VERSION = "BSB";

/** Bundled, selectable versions (all public domain or open-licensed). */
export const BIBLE_VERSIONS: BibleVersion[] = [
  { code: "BSB", name: "Berean Standard Bible" },
  { code: "KJV", name: "King James Version" },
  { code: "WEB", name: "World English Bible" },
  { code: "ASV", name: "American Standard Version" },
  { code: "YLT", name: "Young's Literal Translation" },
];

/** Popular versions we can't bundle (copyright) — these route to feedback. */
export const REQUESTABLE_VERSIONS = [
  "NIV",
  "ESV",
  "NLT",
  "NASB",
  "CSB",
  "NKJV",
];

export function versionName(code: string): string {
  return BIBLE_VERSIONS.find((v) => v.code === code)?.name ?? code;
}

export function isKnownVersion(code: string): boolean {
  return BIBLE_VERSIONS.some((v) => v.code === code);
}
