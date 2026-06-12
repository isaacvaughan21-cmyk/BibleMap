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
    slug: "bible-study-methods-for-beginners",
    title: "Bible Study Methods for Beginners: One Passage, Six Ways",
    description:
      "Six proven Bible study methods for beginners — SOAP, inductive, verse mapping, and more — each shown on the same passage, plus how to choose yours.",
    datePublished: "2026-06-11",
    readingTime: "9 min read",
  },
];
