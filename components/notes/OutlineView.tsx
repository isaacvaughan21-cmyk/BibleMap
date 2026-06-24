import type {
  OutlineCrossRef,
  OutlineGraph,
  OutlineNode,
} from "@/lib/notes/outline";

/**
 * Renders an OutlineGraph (built deterministically from the canvas) as a styled
 * reading document — the same surface the browser prints to PDF. The structure
 * comes straight from the graph: each top-level bubble is a section, and the
 * bubbles branching off it nest beneath, recursively. Each node is formatted by
 * its kind (verse / question / note / definition). No AI, instant, offline.
 *
 * Brand language mirrors the canvas (parchment/ink/gold, serif body, mono verse
 * refs, verse-mark highlights); the @media print rules in globals.css recolor it
 * to high-contrast black-on-white.
 */
export default function OutlineView({ graph }: { graph: OutlineGraph }) {
  return (
    <article className="mx-auto max-w-content px-gutter py-12 md:px-gutter-lg">
      <header className="mb-10 border-b border-rule pb-6">
        <p className="font-sans text-2xs tracking-greek text-gold">ΟΔΟΣ</p>
        <h1 className="mt-2 font-serif text-xl leading-tight text-ink">
          {graph.title || "Untitled map"}
        </h1>
        <p className="mt-3 font-sans text-2xs tracking-eyebrow text-ink-muted">
          STUDY NOTES · {summary(graph)}
        </p>
      </header>

      <div className="space-y-8">
        {graph.roots.map((root) => (
          <RootSection key={root.id} node={root} />
        ))}

        {graph.orphans.length > 0 && (
          <section className="study-themed-section">
            <h2 className="font-serif text-lg text-ink">Loose bubbles</h2>
            <ul className="mt-3 space-y-3 border-l border-rule pl-4">
              {graph.orphans.map((n) => (
                <li
                  key={n.id}
                  id={`node-${n.id}`}
                  className="study-attached-block scroll-mt-6"
                >
                  <NodeBody node={n} />
                  {n.crossRefs.length > 0 && (
                    <CrossRefLine refs={n.crossRefs} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}

function summary(graph: OutlineGraph): string {
  const parts: string[] = [];
  if (graph.stats.rootCount)
    parts.push(plural(graph.stats.rootCount, "section", "sections"));
  parts.push(plural(graph.stats.nodeCount, "bubble", "bubbles"));
  return parts.join(" · ");
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const titleCase = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/** A top-level bubble → a section, with its branches nested beneath. */
function RootSection({ node }: { node: OutlineNode }) {
  return (
    <section
      id={`node-${node.id}`}
      className={`study-verse-section scroll-mt-6 rounded-xl border border-l-[3px] border-l-gold border-rule px-5 py-4 ${
        node.isAnchor ? "node-primary" : ""
      }`}
    >
      <NodeBody node={node} root />
      {node.crossRefs.length > 0 && <CrossRefLine refs={node.crossRefs} />}
      {node.children.length > 0 && (
        <ul className="mt-4 space-y-3 border-l border-rule/60 pl-4">
          {node.children.map((c) => (
            <SubNode key={c.id} node={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** A branch bubble → a nested point, with its own branches deeper still. */
function SubNode({ node }: { node: OutlineNode }) {
  return (
    <li id={`node-${node.id}`} className="study-attached-block scroll-mt-6">
      <NodeBody node={node} />
      {node.crossRefs.length > 0 && <CrossRefLine refs={node.crossRefs} />}
      {node.children.length > 0 && (
        <ul className="mt-2 space-y-2 border-l border-rule/60 pl-4">
          {node.children.map((c) => (
            <SubNode key={c.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Type-aware content for a single bubble. `root` enlarges the heading line. */
function NodeBody({
  node,
  root = false,
}: {
  node: OutlineNode;
  root?: boolean;
}) {
  const anchor = node.isAnchor ? (
    <span className="ml-2 align-middle font-sans text-2xs text-gold">
      ★ anchor
    </span>
  ) : null;

  if (node.kind === "verse") {
    return (
      <>
        <p className="font-mono text-2xs font-medium uppercase tracking-[0.14em] text-gold">
          {node.title || "Untitled verse"}
          {anchor}
        </p>
        {node.text ? (
          <p className="mt-1.5 font-serif text-base leading-relaxed text-ink-soft">
            <Highlighted text={node.text} phrases={node.highlights ?? []} />
          </p>
        ) : null}
      </>
    );
  }

  if (node.kind === "definition") {
    return (
      <p
        className={
          root
            ? "font-serif text-lg text-ink"
            : "font-serif text-base leading-relaxed text-ink-soft"
        }
      >
        <span className="italic text-ink">
          {node.title || "(unnamed term)"}
        </span>
        {node.text ? <> — {node.text}</> : null}
        {anchor}
      </p>
    );
  }

  // question / note / unknown
  const label =
    node.kind === "question"
      ? "Question"
      : node.kind === "note"
        ? "Note"
        : titleCase(node.rawType) || "Note";
  return (
    <div>
      <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
        {label}
        {anchor}
      </p>
      {node.isEmpty ? (
        <p className="mt-0.5">
          <Empty />
        </p>
      ) : (
        <p
          className={`mt-0.5 whitespace-pre-wrap ${
            root
              ? "font-serif text-lg text-ink"
              : "font-serif text-base leading-relaxed text-ink-soft"
          }`}
        >
          {node.text}
        </p>
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

const RE_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const escapeRegExp = (s: string) => s.replace(RE_SPECIAL, "\\$&");

/** Verse text with the reader's marked phrases wrapped in <mark>. */
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

function CrossRefLine({ refs }: { refs: OutlineCrossRef[] }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="font-sans text-2xs tracking-eyebrow text-ink-muted">
        See also
      </span>
      {refs.map((r, i) => (
        <a
          key={i}
          href={`#node-${r.targetId}`}
          className="rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 font-sans text-2xs text-gold transition-colors hover:bg-gold/15"
        >
          {r.targetLabel}
        </a>
      ))}
    </p>
  );
}
