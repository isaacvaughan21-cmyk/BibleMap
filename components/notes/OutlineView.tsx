import type {
  OutlineCrossRef,
  OutlineCrossRefTarget,
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
 * Cross-references are rendered INLINE — the linked passage's text is grouped
 * right under the topic (no "see also" jump links).
 *
 * When `controls` is supplied the document becomes interactive: each item gets
 * a drag handle to reorder it among its siblings (reading-order only — never the
 * canvas) and an "add point" affordance. All of that chrome is .no-print.
 *
 * Brand language mirrors the canvas (parchment/ink/gold, serif body, mono verse
 * refs, verse-mark highlights); the @media print rules in globals.css recolor it
 * to high-contrast black-on-white.
 */

/** The group a row belongs to, as a flat string key for drag scoping. */
export type GroupKey = "roots" | "orphans" | `child:${string}`;

export type DropPos = "before" | "after";

export interface OutlineControls {
  draggingId: string | null;
  overId: string | null;
  /** Which side of the hovered row the drop will land on. */
  dropPos: DropPos | null;
  /** Begin a pointer-driven reorder drag from a row's grab handle. */
  onHandleDown(group: GroupKey, id: string, e: React.PointerEvent): void;
  /** Open the composer to add a child under `parentId` (null = new section). */
  onAdd(parentId: string | null): void;
}

export default function OutlineView({
  graph,
  controls,
}: {
  graph: OutlineGraph;
  controls?: OutlineControls;
}) {
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
          <RootSection key={root.id} node={root} controls={controls} />
        ))}

        {graph.orphans.length > 0 && (
          <section className="study-themed-section">
            <h2 className="font-serif text-lg text-ink">Loose bubbles</h2>
            <ul className="mt-3 space-y-3 border-l border-rule pl-4">
              {graph.orphans.map((n) => (
                <NodeListItem
                  key={n.id}
                  node={n}
                  group="orphans"
                  controls={controls}
                />
              ))}
            </ul>
          </section>
        )}

        {controls && (
          <div className="no-print pt-2">
            <AddButton
              label="+ Add section"
              onClick={() => controls.onAdd(null)}
            />
          </div>
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

/** The dragged row dims; everything else keeps its normal styling. */
function dragClasses(
  controls: OutlineControls | undefined,
  id: string,
): string {
  return controls && controls.draggingId === id ? "opacity-40" : "";
}

/**
 * Data attributes the pointer-drag controller (in NotesScreen) reads via
 * `elementFromPoint().closest('[data-drag-row]')` to find the row under the
 * cursor and which sibling group it belongs to.
 */
function rowDragAttrs(
  controls: OutlineControls | undefined,
  group: GroupKey,
  id: string,
): Record<string, string> {
  if (!controls) return {};
  return { "data-drag-row": id, "data-drag-group": group };
}

/** Gold line marking the gap a drop will land in (above or below a row). */
function DropLine({ pos }: { pos: DropPos }) {
  return (
    <div
      aria-hidden="true"
      className={`no-print pointer-events-none absolute inset-x-0 z-10 flex items-center ${
        pos === "before" ? "-top-1.5" : "-bottom-1.5"
      }`}
    >
      <span className="-ml-1 h-2 w-2 rounded-full bg-gold" />
      <span className="h-0.5 flex-1 rounded-full bg-gold" />
    </div>
  );
}

/** Whether this row should show the drop indicator right now. */
function showDrop(controls: OutlineControls | undefined, id: string): boolean {
  return (
    !!controls &&
    controls.overId === id &&
    controls.draggingId !== null &&
    controls.draggingId !== id &&
    controls.dropPos !== null
  );
}

/** A top-level bubble → a section, with its branches nested beneath. */
function RootSection({
  node,
  controls,
}: {
  node: OutlineNode;
  controls?: OutlineControls;
}) {
  return (
    <section
      id={`node-${node.id}`}
      {...rowDragAttrs(controls, "roots", node.id)}
      className={`study-verse-section relative scroll-mt-6 rounded-xl border border-l-[3px] border-l-gold border-rule px-5 py-4 ${
        node.isAnchor ? "node-primary" : ""
      } ${dragClasses(controls, node.id)}`}
    >
      {showDrop(controls, node.id) && <DropLine pos={controls!.dropPos!} />}
      <div className="flex items-start gap-2">
        {controls && (
          <DragHandle group="roots" id={node.id} controls={controls} />
        )}
        <div className="min-w-0 flex-1">
          <NodeBody node={node} root />
          {node.crossRefs.length > 0 && <CrossRefGroup refs={node.crossRefs} />}
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-4 space-y-3 border-l border-rule/60 pl-4">
          {node.children.map((c) => (
            <NodeListItem
              key={c.id}
              node={c}
              group={`child:${node.id}`}
              controls={controls}
            />
          ))}
        </ul>
      )}
      {controls && (
        <div className="no-print mt-3">
          <AddButton
            label="+ Add point"
            onClick={() => controls.onAdd(node.id)}
          />
        </div>
      )}
    </section>
  );
}

/** A branch (or loose) bubble → a nested point, with its own branches deeper. */
function NodeListItem({
  node,
  group,
  controls,
}: {
  node: OutlineNode;
  group: GroupKey;
  controls?: OutlineControls;
}) {
  return (
    <li
      id={`node-${node.id}`}
      {...rowDragAttrs(controls, group, node.id)}
      className={`study-attached-block relative scroll-mt-6 rounded-lg ${dragClasses(
        controls,
        node.id,
      )}`}
    >
      {showDrop(controls, node.id) && <DropLine pos={controls!.dropPos!} />}
      <div className="flex items-start gap-2">
        {controls && (
          <DragHandle group={group} id={node.id} controls={controls} />
        )}
        <div className="min-w-0 flex-1">
          <NodeBody node={node} />
          {node.crossRefs.length > 0 && <CrossRefGroup refs={node.crossRefs} />}
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-2 space-y-2 border-l border-rule/60 pl-4">
          {node.children.map((c) => (
            <NodeListItem
              key={c.id}
              node={c}
              group={`child:${node.id}`}
              controls={controls}
            />
          ))}
        </ul>
      )}
      {controls && (
        <div className="no-print mt-2">
          <AddButton
            label="+ Add point"
            onClick={() => controls.onAdd(node.id)}
          />
        </div>
      )}
    </li>
  );
}

/** No-print grab handle that starts a reorder drag for one row. */
function DragHandle({
  group,
  id,
  controls,
}: {
  group: GroupKey;
  id: string;
  controls: OutlineControls;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        // Pointer-driven drag (not native HTML5 DnD, which is unreliable here).
        // preventDefault stops text selection / focus side-effects.
        e.preventDefault();
        controls.onHandleDown(group, id, e);
      }}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className="no-print mt-0.5 shrink-0 cursor-grab touch-none select-none rounded text-ink-muted/50 transition-colors hover:text-gold active:cursor-grabbing"
    >
      <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
        <g fill="currentColor">
          <circle cx="4" cy="3" r="1.4" />
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="4" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="4" cy="13" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </g>
      </svg>
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-dashed border-rule px-3 py-1 font-sans text-2xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
    >
      {label}
    </button>
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

/**
 * Cross-references rendered INLINE: the linked passage's own text grouped right
 * under the topic, instead of a "see also" jump link. Leaf content only.
 */
function CrossRefGroup({ refs }: { refs: OutlineCrossRef[] }) {
  return (
    <div className="mt-3 space-y-2 border-l-2 border-gold/30 pl-3">
      {refs.map((r, i) => (
        <CrossRefContent key={`${r.targetId}-${i}`} target={r.target} />
      ))}
    </div>
  );
}

/** One linked passage's verbatim content, formatted by kind (compact leaf). */
function CrossRefContent({ target }: { target: OutlineCrossRefTarget }) {
  if (target.kind === "verse") {
    return (
      <div>
        <p className="font-mono text-2xs font-medium uppercase tracking-[0.14em] text-gold/90">
          {target.title || "Untitled verse"}
        </p>
        {target.text ? (
          <p className="mt-1 font-serif text-sm leading-relaxed text-ink-soft">
            <Highlighted text={target.text} phrases={target.highlights ?? []} />
          </p>
        ) : null}
      </div>
    );
  }

  if (target.kind === "definition") {
    return (
      <p className="font-serif text-sm leading-relaxed text-ink-soft">
        <span className="italic text-ink">
          {target.title || "(unnamed term)"}
        </span>
        {target.text ? <> — {target.text}</> : null}
      </p>
    );
  }

  const label =
    target.kind === "question"
      ? "Question"
      : target.kind === "note"
        ? "Note"
        : "Note";
  return (
    <div>
      <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink-soft">
        {target.text || "(empty)"}
      </p>
    </div>
  );
}
