import type { ReactNode } from "react";
import type {
  AICrossRef,
  AIKeyWord,
  AIPassage,
  AISection,
  AISourcedLine,
  AIStudyDoc,
  AITakeaway,
} from "@/lib/notes/ai-study-doc";

/**
 * Renders an AI-generated AIStudyDoc as a styled reading document — the same
 * surface the browser prints to PDF. Brand language mirrors the canvas
 * (parchment/ink/gold, serif body, mono verse refs, verse-mark highlights); the
 * @media print rules in globals.css recolor it to high-contrast black-on-white.
 *
 * Core rule: the user's OWN words (source = user_*) read as the dominant serif
 * ink voice; anything the model added (ai_*) renders as a clearly-labeled,
 * visually-secondary aside — so the reader always knows which words are theirs.
 */
export default function AIStudyDocView({ doc }: { doc: AIStudyDoc }) {
  const looseByTriage = groupLoose(doc);
  // Render every question bubble exactly once, whether or not the model also
  // mirrored it into openQuestions (don't trust the model to de-dupe for us).
  const openIds = new Set(doc.openQuestions.map((q) => q.nodeId));
  const extraQuestions = looseByTriage.question.filter(
    (b) => !openIds.has(b.nodeId),
  );
  return (
    <article className="mx-auto max-w-content px-gutter py-12 md:px-gutter-lg">
      <header className="mb-8 border-b border-rule pb-6">
        <p className="font-sans text-2xs tracking-greek text-gold">ΟΔΟΣ</p>
        <h1 className="mt-2 font-serif text-xl leading-tight text-ink">
          {doc.title || "Untitled study"}
        </h1>
        {doc.focus?.statement && (
          <p className="mt-3 font-serif text-md italic leading-relaxed text-ink-soft">
            {doc.focus.statement}
          </p>
        )}
        <p className="mt-3 font-sans text-2xs tracking-eyebrow text-ink-muted">
          AI STUDY NOTES · {summary(doc)}
        </p>
      </header>

      <div className="space-y-10">
        {doc.passages.length > 0 && (
          <section>
            <h2 className="font-serif text-lg text-ink">Passages</h2>
            <div className="mt-3 space-y-5">
              {doc.passages.map((p) => (
                <PassageView key={p.nodeId} passage={p} />
              ))}
            </div>
          </section>
        )}

        {doc.sections.map((s) => (
          <SectionView key={s.nodeId} section={s} />
        ))}

        {(doc.openQuestions.length > 0 || extraQuestions.length > 0) && (
          <section className="study-themed-section">
            <h2 className="font-serif text-lg text-ink">
              Questions to explore
            </h2>
            <ul className="mt-3 space-y-3 border-l border-rule pl-4">
              {doc.openQuestions.map((q) => (
                <li key={q.nodeId} className="study-attached-block">
                  <p className="font-serif text-base leading-relaxed text-ink-soft">
                    {q.question}
                  </p>
                  {q.aiAngle && (
                    <AiAside label="Angle to consider">{q.aiAngle}</AiAside>
                  )}
                </li>
              ))}
              {extraQuestions.map((b) => (
                <li key={b.nodeId} className="study-attached-block">
                  <p className="font-serif text-base leading-relaxed text-ink-soft">
                    {b.text || <Empty />}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(["insight", "application", "unsorted"] as const).map((bucket) =>
          looseByTriage[bucket].length > 0 ? (
            <section key={bucket} className="study-themed-section">
              <h2 className="font-serif text-lg text-ink">
                {LOOSE_TITLES[bucket]}
              </h2>
              <ul className="mt-3 space-y-3 border-l border-rule pl-4">
                {looseByTriage[bucket].map((b) => (
                  <li key={b.nodeId} className="study-attached-block">
                    <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
                      {b.label}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap font-serif text-base leading-relaxed text-ink-soft">
                      {b.text || <Empty />}
                    </p>
                    {b.aiNote && <AiAside>{b.aiNote}</AiAside>}
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}

        {doc.application.takeaways.length > 0 && (
          <section className="study-themed-section">
            <h2 className="font-serif text-lg text-ink">
              Application &amp; takeaways
            </h2>
            <ul className="mt-3 space-y-3 border-l border-rule pl-4">
              {doc.application.takeaways.map((t, i) => (
                <li key={i}>
                  <TakeawayView takeaway={t} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {doc.prayer && (
          <section className="study-themed-section">
            <h2 className="font-serif text-lg text-ink">Prayer</h2>
            <p className="mt-2 whitespace-pre-wrap font-serif text-base italic leading-relaxed text-ink-soft">
              {doc.prayer}
            </p>
          </section>
        )}
      </div>

      {doc.meta.coverageNote && (
        <p className="mt-10 border-t border-rule/60 pt-4 font-sans text-2xs italic text-ink-muted/70">
          {doc.meta.coverageNote}
        </p>
      )}
    </article>
  );
}

const LOOSE_TITLES = {
  insight: "Insights",
  application: "Applications",
  unsorted: "Other notes",
} as const;

function groupLoose(doc: AIStudyDoc) {
  const out = {
    insight: [] as AIStudyDoc["looseBubbles"],
    question: [] as AIStudyDoc["looseBubbles"],
    application: [] as AIStudyDoc["looseBubbles"],
    unsorted: [] as AIStudyDoc["looseBubbles"],
  };
  for (const b of doc.looseBubbles) {
    if (b.triage === "insight") out.insight.push(b);
    else if (b.triage === "question") out.question.push(b);
    else if (b.triage === "application") out.application.push(b);
    else out.unsorted.push(b);
  }
  return out;
}

function summary(doc: AIStudyDoc): string {
  const parts: string[] = [];
  if (doc.sections.length)
    parts.push(plural(doc.sections.length, "section", "sections"));
  if (doc.passages.length)
    parts.push(plural(doc.passages.length, "passage", "passages"));
  return parts.join(" · ") || `${doc.meta.nodeCount} bubbles`;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function PassageView({ passage }: { passage: AIPassage }) {
  return (
    <div
      id={`node-${passage.nodeId}`}
      className="study-verse-section scroll-mt-6 rounded-xl border border-l-[3px] border-l-gold border-rule px-5 py-4"
    >
      <p className="font-mono text-2xs font-medium uppercase tracking-[0.14em] text-gold">
        {passage.reference}
      </p>
      {passage.verseText ? (
        <p className="mt-1.5 font-serif text-base leading-relaxed text-ink-soft">
          <Highlighted text={passage.verseText} phrases={passage.highlights} />
        </p>
      ) : (
        <p className="mt-1.5 font-sans text-2xs italic text-ink-muted/70">
          reference only — no verse text saved
        </p>
      )}

      {passage.keyWords.length > 0 && (
        <div className="mt-3 space-y-2">
          {passage.keyWords.map((kw, i) => (
            <KeyWordView key={i} kw={kw} />
          ))}
        </div>
      )}

      {passage.crossRefs.length > 0 && (
        <CrossRefLine refs={passage.crossRefs} />
      )}
    </div>
  );
}

function KeyWordView({ kw }: { kw: AIKeyWord }) {
  return (
    <div>
      <p className="font-serif text-base leading-relaxed text-ink-soft">
        <span className="italic text-ink">{kw.word}</span>
        {kw.userDefinition ? <> — {kw.userDefinition}</> : null}
      </p>
      {kw.aiGloss && (
        <AiAside
          label={kw.confidence === "tentative" ? "AI · tentative" : "AI gloss"}
        >
          {kw.aiGloss}
        </AiAside>
      )}
    </div>
  );
}

function SectionView({ section }: { section: AISection }) {
  return (
    <section
      id={`node-${section.nodeId}`}
      className="study-verse-section scroll-mt-6"
    >
      <h2 className="font-serif text-lg text-ink">{section.heading}</h2>
      {section.anchorRef && (
        <p className="mt-0.5 font-mono text-2xs uppercase tracking-[0.14em] text-gold/80">
          {section.anchorRef}
        </p>
      )}

      {section.observations.length > 0 && (
        <div className="mt-3 space-y-2 border-l border-rule pl-4">
          {section.observations.map((o, i) => (
            <SourcedText key={i} line={o} />
          ))}
        </div>
      )}

      {section.subsections.length > 0 && (
        <div className="mt-4 space-y-4 border-l border-rule/60 pl-4">
          {section.subsections.map((sub) => (
            <div
              key={sub.nodeId}
              id={`node-${sub.nodeId}`}
              className="study-attached-block scroll-mt-6"
            >
              <p className="font-sans text-sm font-medium text-ink">
                {sub.heading}
              </p>
              {sub.points.length > 0 && (
                <ul className="mt-1.5 space-y-1.5">
                  {sub.points.map((pt, i) => (
                    <li key={i}>
                      <SourcedText line={pt} />
                    </li>
                  ))}
                </ul>
              )}
              {sub.depthCollapsed && (
                <p className="mt-1 font-sans text-2xs italic text-ink-muted/60">
                  + deeper points folded in
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TakeawayView({ takeaway }: { takeaway: AITakeaway }) {
  if (takeaway.source === "user_verbatim") {
    return (
      <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-ink-soft">
        {takeaway.text}
      </p>
    );
  }
  return <AiAside label="AI suggestion">{takeaway.text}</AiAside>;
}

/** A sourced line: the user's words read as body; AI lines render as an aside. */
function SourcedText({ line }: { line: AISourcedLine }) {
  if (line.source === "user_verbatim") {
    return (
      <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-ink-soft">
        {line.text || <Empty />}
      </p>
    );
  }
  return (
    <AiAside label={line.source === "ai_connection" ? "AI · connection" : "AI"}>
      {line.text}
    </AiAside>
  );
}

/** Visually-secondary, clearly-labeled AI commentary. */
function AiAside({
  label = "AI",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <p className="ai-aside mt-1.5 border-l-2 border-gold/40 pl-2.5 font-sans text-xs leading-relaxed text-ink-muted">
      <span className="mr-1.5 align-middle font-medium uppercase tracking-eyebrow text-gold/70 text-[10px]">
        {label}
      </span>
      {children}
    </p>
  );
}

function Empty() {
  return (
    <span className="font-serif text-base italic text-ink-muted/60">
      (empty)
    </span>
  );
}

const RE_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const escapeRegExp = (s: string) => s.replace(RE_SPECIAL, "\\$&");

/** Verse text with the user's marked phrases wrapped in <mark>. */
function Highlighted({ text, phrases }: { text: string; phrases: string[] }) {
  const present = [...new Set(phrases)].filter((p) => p && text.includes(p));
  if (!present.length) return <>{text}</>;
  const re = new RegExp(
    `(${present
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|")})`,
    "g",
  );
  return (
    <>
      {text
        .split(re)
        .filter((s) => s !== "")
        .map((part, i) =>
          present.includes(part) ? (
            <mark key={i} className="verse-mark">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
    </>
  );
}

function CrossRefLine({ refs }: { refs: AICrossRef[] }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="font-sans text-2xs tracking-eyebrow text-ink-muted">
        See also
      </span>
      {refs.map((r, i) =>
        r.targetNodeId ? (
          <a
            key={i}
            href={`#node-${r.targetNodeId}`}
            className="rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 font-sans text-2xs text-gold transition-colors hover:bg-gold/15"
            title={r.note ?? undefined}
          >
            {r.reference}
            {r.via === "ai_connection" && (
              <span className="ml-1 text-gold/60">·AI</span>
            )}
          </a>
        ) : (
          <span
            key={i}
            className="rounded-full border border-rule px-2 py-0.5 font-sans text-2xs text-ink-muted"
            title={r.note ?? undefined}
          >
            {r.reference}
            {r.via === "ai_connection" && (
              <span className="ml-1 text-ink-muted/60">·AI</span>
            )}
          </span>
        ),
      )}
    </p>
  );
}
