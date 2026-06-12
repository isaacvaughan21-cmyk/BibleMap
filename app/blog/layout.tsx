import Link from "next/link";
import Footer from "@/components/Footer";

/**
 * Blog chrome — a quieter cousin of the landing Nav (whose links are
 * homepage anchors), plus the shared Footer. Articles set their own
 * metadata; this layout only provides structure.
 */
export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-rule/60 bg-parchment/70 backdrop-blur-md">
        <nav
          aria-label="Primary"
          className="mx-auto flex h-16 max-w-content items-center justify-between px-gutter md:px-gutter-lg"
        >
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-md text-ink">Hodos</span>
            <span className="font-sans text-2xs tracking-greek text-gold">
              ΟΔΟΣ
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/blog"
              className="hidden font-sans text-xs tracking-eyebrow text-ink-muted transition-colors hover:text-ink sm:inline-block"
            >
              JOURNAL
            </Link>
            <a
              href="/app"
              target="_blank"
              rel="noopener"
              className="rounded-full bg-gold px-4 py-2 font-sans text-2xs font-medium tracking-eyebrow text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-lg hover:shadow-ink/15"
            >
              TRY IT FREE
            </a>
          </div>
        </nav>
      </header>

      <main className="relative pt-16">
        <div
          className="dot-grid pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        <div className="relative">{children}</div>
      </main>

      <Footer />
    </>
  );
}
