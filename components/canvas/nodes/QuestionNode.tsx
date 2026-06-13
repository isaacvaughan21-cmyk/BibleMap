import type { NodeProps } from "@xyflow/react";
import type { QuestionNodeType } from "@/lib/types";
import { useCanvasStore } from "@/lib/store/canvas-store";
import NodeHandles from "./NodeHandles";
import NodeEditor from "./NodeEditor";
import NestBadge from "./NestBadge";
import { floatStyle } from "./float";

/** A question bubble — the seed of a study. Gold ?-glyph + serif text. */
export default function QuestionNode({
  id,
  data,
  selected,
}: NodeProps<QuestionNodeType>) {
  const editing = useCanvasStore((s) => s.editingNodeId) === id;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setEditing = useCanvasStore((s) => s.setEditing);

  return (
    <div
      className={`relative ${editing ? "" : "floaty"}`}
      style={floatStyle(id)}
    >
      <NestBadge id={id} />
      <div
        className={`bubble flex max-w-xs items-center gap-3 rounded-full border bg-parchment py-2.5 pl-3 pr-6 ${
          selected ? "bubble-selected border-gold" : "border-rule"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <span className="font-serif text-sm leading-none text-gold">?</span>
        </span>
        {editing ? (
          <NodeEditor
            value={data.content}
            placeholder="What are you wondering?"
            className="w-52 font-serif text-base leading-snug text-ink"
            onCommit={(v) => {
              updateNodeData(id, { content: v });
              setEditing(null);
            }}
          />
        ) : (
          <p className="font-serif text-base leading-snug text-ink">
            {data.content || (
              <span className="text-ink-muted/60">New question</span>
            )}
          </p>
        )}
        <NodeHandles />
      </div>
    </div>
  );
}
