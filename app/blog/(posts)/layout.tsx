/**
 * Shared article column for every post under app/blog/(posts)/<slug>/page.mdx.
 * ~70ch measure at body size — long-form reading width on parchment.
 */
export default function PostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl px-gutter py-rhythm md:px-0">
      {children}
    </article>
  );
}
