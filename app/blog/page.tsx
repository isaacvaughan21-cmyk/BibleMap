import type { Metadata } from "next";
import Link from "next/link";
import { posts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Journal — Hodos",
  description:
    "Field guides on studying Scripture well — methods, habits, and the craft of asking better questions. From the makers of Hodos, a visual canvas for Bible study.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Journal — Hodos",
    description:
      "Field guides on studying Scripture well — methods, habits, and the craft of asking better questions.",
    url: "/blog",
    siteName: "Hodos",
    type: "website",
  },
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export default function BlogIndex() {
  return (
    <div className="mx-auto max-w-2xl px-gutter py-rhythm md:px-0">
      <p className="mb-3 font-sans text-2xs tracking-eyebrow text-gold">
        JOURNAL
      </p>
      <h1 className="mb-4 font-serif text-xl leading-tight text-ink md:text-2xl">
        Notes on the way
      </h1>
      <p className="mb-12 font-sans text-base leading-relaxed text-ink-muted md:text-md">
        Field guides on studying Scripture well — methods, habits, and the craft
        of asking better questions.
      </p>

      <ul className="space-y-10">
        {posts.map((post) => (
          <li key={post.slug} className="border-t border-rule pt-8">
            <p className="mb-2 font-sans text-2xs text-ink-muted">
              {dateFormat.format(new Date(post.datePublished))} ·{" "}
              {post.readingTime}
            </p>
            <h2 className="mb-2 font-serif text-lg leading-snug text-ink">
              <Link
                href={`/blog/${post.slug}`}
                className="transition-colors hover:text-gold"
              >
                {post.title}
              </Link>
            </h2>
            <p className="mb-3 font-sans text-base leading-relaxed text-ink-soft">
              {post.description}
            </p>
            <Link
              href={`/blog/${post.slug}`}
              className="font-sans text-xs tracking-eyebrow text-gold transition-colors hover:text-ink"
            >
              READ THE GUIDE
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
