/** Footer — wordmark + Greek, copyright, single email link. */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-rule px-gutter py-12 md:px-gutter-lg">
      <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-md text-ink">Hodos</span>
          <span className="font-sans text-2xs tracking-greek text-gold">
            ΟΔΟΣ
          </span>
        </div>

        <p className="font-sans text-2xs text-ink-muted">
          © {year} Hodos. All rights reserved.
        </p>

        <a
          href="mailto:hello@hodos.app"
          className="font-sans text-xs text-gold transition-colors hover:text-ink"
        >
          hello@hodos.app
        </a>
      </div>
    </footer>
  );
}
