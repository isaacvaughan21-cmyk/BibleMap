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
    version: "0.14.1",
    date: "2026-08-06",
    title: "A shelf your group shares",
    changes: [
      "A group is no longer one map. Your library now has a “My groups” section, and each group keeps a whole shelf of studies — start a new one for this week without losing last week’s.",
      "You can start a group or join one with a code from the library itself, without going back to the canvas.",
      "Bring your own work in: drag any study onto a group, or pick “Share one of mine…”. It stays yours — still on your shelves — and everyone in the group can now study it with you, live.",
      "Name the group whatever you actually call it, and rename it later; anyone in it can.",
      "Take a study back out whenever you like. Leave a group and the studies you brought stay in your library — only the group’s own maps go with it.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-08-06",
    title: "A one-minute walk",
    changes: [
      "New here? Hodos now walks you through it — a short guided tour that has you build a real map as you go, rather than watching someone else’s.",
      "It follows you: ask your first question, set a verse beside it, draw the line between them, dive into a bubble and rise back out — each step marks itself done the moment you do it, so nothing is explained twice.",
      "Along the way it points out Ask Scripture and the ··· menu, then leaves you on your own map with everything you made still there.",
      "You can leave at any point, and replay the whole walk whenever you like from ··· → “Replay the guided tour”.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-08-03",
    title: "Your library",
    changes: [
      "Every study you’ve made now has a room of its own. Press Escape from a canvas — or pick “Your library” from the ··· menu — and your maps lay out as cards, each drawing its own miniature so you can recognise a study before you read its name.",
      "Put your work in order: make shelves and drag studies onto them, add tags like “sermon” or “small group”, and pin whatever you’re in the middle of so it’s always first.",
      "Every card tells you which books of the Bible it reaches into, worked out from your own verse bubbles — nothing to tag. Switch to “By book” and the whole library indexes itself from Genesis to Revelation.",
      "Search reads inside your maps, not just their names, so “bronze serpent” finds the study even when you called it something else.",
      "Finished with a study? Archive it. It leaves the shelf and keeps everything, so nothing has to be deleted to tidy up.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-08-03",
    title: "Read in the ESV",
    changes: [
      "The English Standard Version is now one of the translations you can study in. Pick ESV from the ··· menu and every verse bubble, cross-reference, and passage reads in the ESV.",
      "That makes seven translations in all, and you can still switch a single verse to another version from its own menu without changing the rest of your map.",
      "ESV text is used under licence from Crossway, so it’s read a chapter at a time straight from their library rather than stored with the app.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-07-06",
    title: "Study together, live",
    changes: [
      "Create a group and study one map together in real time. Open the new people icon in the top bar, make a group, and share the invite link — everyone sees each other’s bubbles, connections, and cursors as they’re drawn.",
      "You can see who’s in the room, and while someone is typing in a bubble, it’s held for them so two people never overwrite the same thought.",
      "Your own view stays yours — your theme, streak, and undo history are personal, even on a shared map. (Sign in to create or join a group.)",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-30",
    title: "Map of the Day",
    changes: [
      "A fresh starter map every day — a verse, the question it raises, and a few related verses to explore. Open it from the ··· menu, or read it (and share it) at /map-of-the-day.",
      "It’s yours to build on: “Save to my canvas” drops the question and verses into your own library as a new, fully editable canvas, where you draw the connections and add your own thoughts.",
      "Every verse is drawn straight from Scripture — the same “never a verse that isn’t really there” checking the Ask assistant uses.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-06-27",
    title: "Undo & easier highlights",
    changes: [
      "Changed something you didn’t mean to? Press Ctrl/Cmd+Z to undo (Ctrl/Cmd+Shift+Z to redo), or use the new undo and redo buttons by the zoom controls — it covers creating, moving, connecting, deleting, editing, and highlighting.",
      "Editing a highlight is simpler now: click a highlighted phrase to recolour it or remove it, right where it sits.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-27",
    title: "Colour themes & highlighters",
    changes: [
      "Give your study a new look — open the ··· menu and pick a Theme. Classic keeps the parchment-and-gold look, while Pastel, Meadow, Ocean, Sunset, and Berry give each kind of bubble its own colour, with a matching canvas background.",
      "Highlight a verse in the colour you choose: select a phrase and pick from six highlighter pens, or the theme’s own colour.",
      "The dots you drag to connect bubbles are a little larger now, so they’re easier to grab.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-27",
    title: "New Living Translation",
    changes: [
      "Read and study in the New Living Translation — pick it from the version menu just like any other translation.",
      "It works everywhere the other versions do: the verse picker, the side-by-side versions tab, surrounding context, and per-verse switching.",
    ],
  },
  {
    version: "0.5.1",
    date: "2026-06-25",
    title: "Ask Scripture handles typos",
    changes: [
      "The Ask assistant now forgives misspellings — “who wrote reveltino” still finds Revelation, and “what does the bible say about graec” still finds grace.",
      "When a question doesn’t match anything in Scripture, it now says so plainly instead of returning unrelated verses.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-25",
    title: "Ask Scripture",
    changes: [
      "Ask a question about the Bible right on the canvas — open the study panel to “Ask”, type a question, and get an answer drawn only from Scripture, with every point backed by cited verses.",
      "Ask who wrote a book, who a person in the Bible was, or what the Bible says about a topic; ambiguous names (several Marys or Jameses) are shown as the distinct people.",
      "Searching a topic? Toggle your verses between the New and Old Testament — and add any cited verse straight onto your canvas, linked under your question.",
      "Off-topic or opinion questions are gently turned back to what the text actually says, and references are checked against the Bible so a verse never comes back wrong.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-06-24",
    title: "Editable study notes",
    changes: [
      "“Compile to notes” now groups each cross-referenced passage right under its point, so you read it in place instead of chasing a “see also” link.",
      "Reorder your notes by dragging — a guide line shows exactly where a point will land, and the page scrolls as you drag past the edge. This only changes the document, not your canvas.",
      "Add a verse, note, question, or definition straight from the notes view; it also drops a matching bubble on your canvas — linked under its topic, or free-floating when you add a new section.",
    ],
  },
  {
    version: "0.3.5",
    date: "2026-06-15",
    title: "Verse picking & highlighting",
    changes: [
      "Picking a verse now opens on a quick number grid — switch to “Read” any time to choose by the verse text.",
      "Books are listed by their full names, so you don't have to recognise an abbreviation.",
      "Select a span of verses at once: switch the picker to “Range”, then click the first and last verse.",
      "Highlighting is smoother — drag a bubble to move it, and once it's selected, drag across the words to highlight them in gold.",
      "Click a highlight to read it without losing it; right-click to remove it.",
      "Opening the study panel on a verse drawn from a cross-reference no longer shows a “couldn't read this reference” error.",
      "In the study panel's context view, the verse you're studying is now clearly outlined so it's easy to find.",
    ],
  },
  {
    version: "0.3.4",
    date: "2026-06-13",
    title: "Study & canvas depth",
    changes: [
      "Picking a verse now lists the whole chapter so you can read and choose by text, not just by number.",
      "Highlight words or phrases in a verse — select the text and click “Highlight”.",
      "The first verse on each canvas now stands out, marking the heart of your study.",
      "Bubbles that open into their own map now show a small badge, and the study panel closes cleanly as you dive in and back out.",
      "Drag either end of a connection onto a different bubble to re-route it.",
      "A verse's study panel no longer points back to the verse it came from.",
    ],
  },
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
