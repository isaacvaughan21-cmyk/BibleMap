/**
 * Blog post registry — one entry per post under app/blog/<slug>/page.mdx.
 * The index page and sitemap read from here so a new post only needs its
 * MDX file plus one entry below.
 */
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  /** ISO date, e.g. "2026-06-11" */
  datePublished: string;
  readingTime: string;
};

export const posts: BlogPost[] = [
  {
    slug: "verse-mapping-step-by-step-romans-8-28",
    title: "Verse Mapping: A Step-by-Step Method (Romans 8:28)",
    description:
      "Learn verse mapping in 7 steps with a worked example on Romans 8:28 — a real, repeatable Bible-study method you can do on one verse this week.",
    datePublished: "2026-06-14",
    readingTime: "10 min read",
  },
  {
    slug: "how-to-lead-a-small-group-bible-study",
    title: "How to Lead a Small Group Bible Study (First-Time Guide)",
    description:
      "Learn how to lead a small group Bible study: prepare a passage, write discussion questions that work, handle silence, and guide your first meeting well.",
    datePublished: "2026-06-12",
    readingTime: "10 min read",
  },
  {
    slug: "bible-study-methods-for-beginners",
    title: "Bible Study Methods for Beginners: One Passage, Six Ways",
    description:
      "Six proven Bible study methods for beginners — SOAP, inductive, verse mapping, and more — each shown on the same passage, plus how to choose yours.",
    datePublished: "2026-06-11",
    readingTime: "9 min read",
  },
];
