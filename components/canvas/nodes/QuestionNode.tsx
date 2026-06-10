import type { NodeProps } from "@xyflow/react";
import type { QuestionNodeType } from "@/lib/sample-map";
import NodeHandles from "./NodeHandles";

/** A question bubble — the seed of a study. Gold ?-glyph + serif text. */
export default function QuestionNode({
  data,
  selected,
}: NodeProps<QuestionNodeType>) {
  return (
    <div
      className={`bubble flex max-w-xs items-center gap-3 rounded-full border bg-parchment py-2.5 pl-3 pr-6 ${
        selected ? "bubble-selected border-gold" : "border-rule"
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
        <span className="font-serif text-sm leading-none text-gold">?</span>
      </span>
      <p className="font-serif text-base leading-snug text-ink">
        {data.content}
      </p>
      <NodeHandles />
    </div>
  );
}
