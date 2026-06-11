import ChangelogDialog from "@/components/ChangelogDialog";

/** Footer — wordmark + Greek, copyright, version history. */
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

        <p className="flex items-center gap-2 font-sans text-2xs text-ink-muted">
          <ChangelogDialog tone="muted" label="open beta" />
          <span aria-hidden="true">·</span>
          <ChangelogDialog tone="muted" />
          <span aria-hidden="true">·</span>© {year} Hodos
        </p>
      </div>
    </footer>
  );
}
