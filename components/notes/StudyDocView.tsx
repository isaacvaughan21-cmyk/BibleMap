import type {
  AttachedBlock,
  CrossRef,
  DocSection,
  StudyDoc,
  TextRun,
  VerseSection,
} from "@/lib/notes/study-doc";

/**
 * Renders a compiled StudyDoc as a styled reading document — the same surface
 * the browser prints to PDF. Brand language mirrors the canvas (parchment/ink/
 * gold, serif body, mono verse refs, verse-mark highlights); the @media print
 * rules in globals.css recolor it to high-contrast black-on-white.
 */
export default function StudyDocView({ doc }: { doc: StudyDoc }) {
  return (
    <article className="mx-auto max-w-content px-gutter py-12 md:px-gutter-lg">
      <header className="mb-10 border-b border-rule pb-6">
        <p className="font-sans text-2xs tracking-greek text-gold">ΟΔΟΣ</p>
        <h1 className="mt-2 font-serif text-xl leading-tight text-ink">
          {doc.title || "Untitled map"}
        </h1>
        <p className="mt-3 font-sans text-2xs tracking-eyebrow text-ink-muted">
          STUDY NOTES · {summary(doc)}
        </p>
      </header>

      <div className="space-y-10">
        {doc.sections.map((section) => (
          <SectionView key={sectionKey(section)} section={section} />
        ))}
      </div>
    </article>
  );
}

function summary(doc: StudyDoc): string {
  const s = doc.stats;
  const parts: string[] = [];
  if (s.verseCount) parts.push(plural(s.verseCount, "passage", "passages"));
  const notes = s.nodeCount - s.verseCount;
  if (notes > 0) parts.push(plural(notes, "note", "notes"));
  return parts.join(" · ") || "empty map";
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function sectionKey(section: DocSection): string {
  if (section.type === "verse") return `v-${section.nodeId}`;
  if (section.type === "themed") return `t-${section.groupId}`;
  return "orphans";
}

function SectionView({ section }: { section: DocSection }) {
  if (section.type === "verse") return <VerseSectionView section={section} />;

  // themed + orphans share a heading + block list
  return (
    <section className="study-themed-section">
      <h2 className="font-serif text-lg text-ink">{section.heading}</h2>
      <div className="mt-3 space-y-4 border-l border-rule pl-4">
        {section.blocks.map((b) => (
          <BlockView key={b.nodeId} block={b} />
        ))}
      </div>
    </section>
  );
}

function VerseSectionView({ section }: { section: VerseSection }) {
  return (
    <section
      id={`node-${section.nodeId}`}
      className={`study-verse-section scroll-mt-6 rounded-xl border border-l-[3px] border-l-gold border-rule px-5 py-4 ${
        section.isAnchor ? "node-primary" : ""
      }`}
    >
      {section.isAnchor && (
        <p className="mb-1.5 font-sans text-2xs tracking-eyebrow text-gold">
          ★ ANCHOR · THIS STUDY&rsquo;S CENTRE
        </p>
      )}
      <p className="font-mono text-2xs font-medium uppercase tracking-[0.14em] text-gold">
        {section.ref}
      </p>

      {section.runs.length > 0 && (
        <p className="mt-1.5 font-serif text-base leading-relaxed text-ink-soft">
          <Runs runs={section.runs} />
        </p>
      )}

      {section.seeAlso.length > 0 && (
        <CrossRefLine label="See also" refs={section.seeAlso} />
      )}

      {section.attached.length > 0 && (
        <div className="mt-4 space-y-4 border-t border-rule/60 pt-3">
          {section.attached.map((b) => (
            <BlockView key={b.nodeId} block={b} />
          ))}
        </div>
      )}
    </section>
  );
}

function Runs({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.mark ? (
          <mark key={i} className="verse-mark">
            {run.text}
          </mark>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

function BlockView({ block }: { block: AttachedBlock }) {
  return (
    <div className="study-attached-block">
      <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
        {block.label}
        {block.isAnchor && <span className="ml-2 text-gold">★ anchor</span>}
      </p>

      {block.kind === "definition" ? (
        <p className="mt-1 font-serif text-base leading-relaxed text-ink-soft">
          <span className="italic text-ink">{block.term}</span>
          {block.body ? (
            <>
              {" — "}
              {block.body}
            </>
          ) : (
            !block.term && <Empty />
          )}
        </p>
      ) : block.isEmpty ? (
        <p className="mt-1">
          <Empty />
        </p>
      ) : (
        <p className="mt-1 whitespace-pre-wrap font-serif text-base leading-relaxed text-ink-soft">
          {block.body}
        </p>
      )}

      {block.alsoRelatesTo.length > 0 && (
        <CrossRefLine label="Also relates to" refs={block.alsoRelatesTo} />
      )}
    </div>
  );
}

function Empty() {
  return (
    <span className="font-serif text-base italic text-ink-muted/60">
      (empty)
    </span>
  );
}

function CrossRefLine({ label, refs }: { label: string; refs: CrossRef[] }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="font-sans text-2xs tracking-eyebrow text-ink-muted">
        {label}
      </span>
      {refs.map((r) =>
        r.unparseable ? (
          <span
            key={r.targetNodeId}
            className="rounded-full border border-rule px-2 py-0.5 font-sans text-2xs text-ink-muted"
          >
            {r.label}
          </span>
        ) : (
          <a
            key={r.targetNodeId}
            href={`#node-${r.targetNodeId}`}
            className="rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 font-sans text-2xs text-gold transition-colors hover:bg-gold/15"
          >
            {r.label}
          </a>
        ),
      )}
    </p>
  );
}
