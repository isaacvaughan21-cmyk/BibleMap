import type { NodeProps } from "@xyflow/react";
import type { VerseNodeType } from "@/lib/sample-map";
import NodeHandles from "./NodeHandles";

/** A scripture bubble — gold left border, mono reference, serif verse text. */
export default function VerseNode({
  data,
  selected,
}: NodeProps<VerseNodeType>) {
  return (
    <div
      className={`bubble w-64 rounded-xl border border-l-[3px] border-l-gold bg-parchment px-4 py-3 ${
        selected ? "bubble-selected border-gold" : "border-rule"
      }`}
    >
      <p
        className={`font-mono text-2xs font-medium uppercase tracking-[0.14em] ${
          data.verseRef ? "text-gold" : "text-gold/50"
        }`}
      >
        {data.verseRef || "Add reference"}
      </p>
      <p className="mt-1.5 font-serif text-sm leading-relaxed text-ink-soft">
        {data.verseText}
      </p>
      <NodeHandles />
    </div>
  );
}
