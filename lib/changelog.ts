/**
 * Hodos version history — the single source of truth for "what's new".
 *
 * RELEASE PROCESS: every time we push an update to `main`, prepend a new entry
 * here and bump APP_VERSION to match. Keep `changes` to a few plain-language
 * bullets a reader (not just a developer) would care about. The newest release
 * is always first; APP_VERSION must equal CHANGELOG[0].version.
 */

export type Release = {
  version: string;
  /** ISO date (YYYY-MM-DD) the release went to production. */
  date: string;
  /** Short title for the release. */
  title: string;
  changes: string[];
};

export const CHANGELOG: Release[] = [
  {
    version: "0.2.0",
    date: "2026-06-11",
    title: "A living demo & version history",
    changes: [
      "The landing demo now zooms through a bubble into its own nested map — the exact cinematic motion you get inside the app.",
      "On the interactive demo, double-click the glowing verse to dive in, and use “Back to the map” to rise back out.",
      "Click the version number anywhere to see what’s new (this list).",
      "In the canvas, clicking blank space now closes the open study panel.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-11",
    title: "Open beta",
    changes: [
      "Hodos is live — the full canvas is free to try, with nothing to install.",
      "Create a free account with email and password, or keep exploring as a guest.",
      "A “Try it free” button now runs across the landing page, alongside a real interactive demo canvas.",
      "Every bubble can be opened into a whole map of its own, several levels deep.",
    ],
  },
];

/** The current app version — must match the newest changelog entry. */
export const APP_VERSION = CHANGELOG[0].version;
