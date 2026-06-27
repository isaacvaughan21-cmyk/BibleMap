/**
 * Bible translations available in Hodos.
 *
 * Public-domain / freely-licensed versions are bundled with full text (static
 * JSON under public/bible/). Most copyrighted versions (NIV, ESV, NASB…) can't
 * be redistributed without a paid licence, so they're offered as a "request"
 * that routes to the feedback form instead.
 *
 * NLT is the exception: we hold a Tyndale licence to *quote* it, so it's a
 * selectable version but fetched live, server-side, one chapter at a time
 * (lib/nlt.ts + app/api/nlt) rather than bundled. Its required credit line
 * (`NLT_CREDIT`) is shown wherever its text appears.
 */

export type BibleVersion = {
  /** Storage code; also the folder under public/bible/ (BSB lives at the root). */
  code: string;
  name: string;
  /** Fetched live from a licensed API instead of bundled (copyright). */
  live?: boolean;
  /** Required credit line, rendered wherever this version's text is shown. */
  credit?: string;
};

export const DEFAULT_VERSION = "BSB";

/**
 * Tyndale-required attribution for the New Living Translation. Must appear
 * wherever NLT text is quoted.
 */
export const NLT_CREDIT =
  "Scripture quotations marked (NLT) are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Inc., Carol Stream, Illinois 60188. All rights reserved.";

/** Selectable versions — public domain (bundled) plus licensed-live NLT. */
export const BIBLE_VERSIONS: BibleVersion[] = [
  { code: "BSB", name: "Berean Standard Bible" },
  {
    code: "NLT",
    name: "New Living Translation",
    live: true,
    credit: NLT_CREDIT,
  },
  { code: "KJV", name: "King James Version" },
  { code: "WEB", name: "World English Bible" },
  { code: "ASV", name: "American Standard Version" },
  { code: "YLT", name: "Young's Literal Translation" },
];

/** Popular versions we can't bundle (copyright) — these route to feedback. */
export const REQUESTABLE_VERSIONS = ["NIV", "ESV", "NASB", "CSB", "NKJV"];

export function versionName(code: string): string {
  return BIBLE_VERSIONS.find((v) => v.code === code)?.name ?? code;
}

export function isKnownVersion(code: string): boolean {
  return BIBLE_VERSIONS.some((v) => v.code === code);
}

/** True if the version is fetched live (per-chapter) rather than bundled. */
export function isLiveVersion(code: string): boolean {
  return BIBLE_VERSIONS.find((v) => v.code === code)?.live === true;
}

/** The required credit line for a version, if it has one. */
export function versionCredit(code: string): string | undefined {
  return BIBLE_VERSIONS.find((v) => v.code === code)?.credit;
}
