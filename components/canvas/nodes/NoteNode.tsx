import type { NodeProps } from "@xyflow/react";
import type { NoteNodeType } from "@/lib/sample-map";
import NodeHandles from "./NodeHandles";

/** A personal note — borderless, quieter than questions and verses. */
export default function NoteNode({ data, selected }: NodeProps<NoteNodeType>) {
  return (
    <div
      className={`bubble max-w-60 rounded-xl border border-transparent bg-parchment-2 px-4 py-3 ${
        selected ? "bubble-selected border-gold" : ""
      }`}
    >
      <p className="font-serif text-sm italic leading-relaxed text-ink-soft">
        {data.content}
      </p>
      <NodeHandles />
    </div>
  );
}
