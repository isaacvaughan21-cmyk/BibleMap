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
    version: "0.3.3",
    date: "2026-06-12",
    title: "Canvas refinements",
    changes: [
      "An untitled map now names itself after your first bubble — a verse contributes just its reference (“John 3:16”), not the whole verse.",
      "Right-click a verse to show it in another translation; verses can no longer be turned into notes or questions by mistake.",
      "Definition bubbles now offer a short menu of meanings to pick from, so common words land on the right sense.",
      "Connections now point at the bubble you drag to, and you can reverse a connection's direction from its right-click menu.",
      "Long cross-reference verses in the study panel can be expanded with “Show more”.",
      "Smaller overview map, and the create menu no longer gets clipped near the bottom of the screen.",
    ],
  },
  {
    version: "0.3.2",
    date: "2026-06-11",
    title: "Polish: centered what's-new + guest nudge",
    changes: [
      "The “What's new” window now opens centered on screen instead of being clipped at the top.",
      "Exploring as a guest? Once you've started a map, Hodos gently offers to save your work with a free account.",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-06-11",
    title: "Easier canvas deleting",
    changes: [
      "Deleting a canvas is clearer now — the trash icon is always visible in the ··· menu, and you can right-click any canvas to delete it.",
      "Deleting your only canvas now clears it back to a fresh blank one instead of doing nothing.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-11",
    title: "Deeper study tools",
    changes: [
      "New here? You now start with a clean, blank canvas.",
      "Choose your Bible translation — BSB, KJV, WEB, ASV, or YLT — from the ··· menu, or request another.",
      "The study panel now has tabs: cross-references, the same verse in every translation, and its surrounding passage.",
      "Cross-references now name who an unclear “he” or “they” is talking about.",
      "New Definition bubble: type a word and Hodos looks up its meaning.",
      "Delete a canvas you no longer need from the ··· menu.",
    ],
  },
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
