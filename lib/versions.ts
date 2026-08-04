/**
 * Bible translations available in Hodos.
 *
 * Public-domain / freely-licensed versions are bundled with full text (static
 * JSON under public/bible/). Most copyrighted versions (NIV, NASB…) can't be
 * redistributed without a paid licence, so they're offered as a "request" that
 * routes to the feedback form instead.
 *
 * NLT and ESV are the exceptions: we're licensed to *quote* them, so they're
 * selectable versions but fetched live, server-side, one chapter at a time
 * (lib/nlt.ts + app/api/nlt, lib/esv.ts + app/api/esv) rather than bundled.
 * Their required credit lines are shown wherever their text appears.
 */

export type BibleVersion = {
  /** Storage code; also the folder under public/bible/ (BSB lives at the root). */
  code: string;
  name: string;
  /** Fetched live from a licensed API instead of bundled (copyright). */
  live?: boolean;
  /** Required credit line, rendered wherever this version's text is shown. */
  credit?: string;
  /** Link the licence requires alongside the credit line. */
  creditLink?: { href: string; label: string };
  /**
   * Cap on how many verses of this version may be held in a client-side cache,
   * where the licence sets one. Enforced in lib/bible.ts.
   */
  cacheVerseLimit?: number;
};

export const DEFAULT_VERSION = "BSB";

/**
 * Tyndale-required attribution for the New Living Translation. Must appear
 * wherever NLT text is quoted.
 */
export const NLT_CREDIT =
  "Scripture quotations marked (NLT) are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Inc., Carol Stream, Illinois 60188. All rights reserved.";

/**
 * Crossway-required attribution for the English Standard Version, quoted from
 * their approved wording. Crossway additionally requires that every page using
 * ESV text link to www.esv.org — hence `creditLink` below, which the shared
 * VersionCredit component renders alongside this text.
 */
export const ESV_CREDIT =
  "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language.";

/** Crossway caps cached ESV text at 500 verses. */
export const ESV_CACHE_VERSE_LIMIT = 500;

/** Selectable versions — public domain (bundled) plus licensed-live NLT/ESV. */
export const BIBLE_VERSIONS: BibleVersion[] = [
  { code: "BSB", name: "Berean Standard Bible" },
  {
    code: "ESV",
    name: "English Standard Version",
    live: true,
    credit: ESV_CREDIT,
    creditLink: { href: "https://www.esv.org", label: "www.esv.org" },
    cacheVerseLimit: ESV_CACHE_VERSE_LIMIT,
  },
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
export const REQUESTABLE_VERSIONS = ["NIV", "NASB", "CSB", "NKJV"];

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

/** The link a version's licence requires beside its credit line, if any. */
export function versionCreditLink(
  code: string,
): BibleVersion["creditLink"] | undefined {
  return BIBLE_VERSIONS.find((v) => v.code === code)?.creditLink;
}

/** Licence cap on client-side cached verses for a version, if it has one. */
export function versionCacheVerseLimit(code: string): number | undefined {
  return BIBLE_VERSIONS.find((v) => v.code === code)?.cacheVerseLimit;
}
