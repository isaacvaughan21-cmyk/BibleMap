import type { MDXComponents } from "mdx/types";
import Link from "next/link";

/**
 * Global MDX element styling — every blog post under app/blog/ renders
 * through this map, so long-form typography stays on-brand without any
 * per-post classes. Token colors only (see tailwind.config.ts).
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mb-6 font-serif text-xl leading-tight text-ink md:text-2xl">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-4 mt-14 font-serif text-lg leading-snug text-ink md:text-xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-3 mt-8 font-serif text-md leading-snug text-ink md:text-lg">
        {children}
      </h3>
    ),
    // Explicit JSX <p className="..."> in a post (eyebrow, date line) keeps
    // its own classes; bare markdown paragraphs get the body style.
    p: ({ children, className }) => (
      <p
        className={
          className ??
          "mb-5 font-sans text-base leading-relaxed text-ink-soft md:text-md"
        }
      >
        {children}
      </p>
    ),
    a: ({ href, children }) => {
      const isInternal = href?.startsWith("/") || href?.startsWith("#");
      if (isInternal && href) {
        return (
          <Link
            href={href}
            className="text-gold underline decoration-gold/40 underline-offset-2 transition-colors hover:text-ink hover:decoration-ink/40"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          rel="noopener"
          className="text-gold underline decoration-gold/40 underline-offset-2 transition-colors hover:text-ink hover:decoration-ink/40"
        >
          {children}
        </a>
      );
    },
    ul: ({ children }) => (
      <ul className="mb-5 ml-5 list-disc space-y-2 font-sans text-base leading-relaxed text-ink-soft marker:text-gold md:text-md">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-5 ml-5 list-decimal space-y-2 font-sans text-base leading-relaxed text-ink-soft marker:text-gold md:text-md">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-2 border-gold pl-5 font-serif text-md italic leading-relaxed text-ink [&_p]:mb-2 [&_p]:font-serif [&_p]:text-md [&_p]:text-ink">
        {children}
      </blockquote>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-ink">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    hr: () => <hr className="my-10 border-rule" />,
    table: ({ children }) => (
      <div className="mb-5 overflow-x-auto">
        <table className="w-full border-collapse font-sans text-xs text-ink-soft md:text-base">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-rule px-3 py-2 text-left font-semibold text-ink">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-rule px-3 py-2 align-top">{children}</td>
    ),
    ...components,
  };
}
