import type { NodeProps } from "@xyflow/react";
import type { NoteNodeType } from "@/lib/types";
import { useCanvasStore } from "@/lib/store/canvas-store";
import NodeHandles from "./NodeHandles";
import NodeEditor from "./NodeEditor";
import NestBadge from "./NestBadge";
import { floatStyle } from "./float";

/** A personal note — borderless, quieter than questions and verses. */
export default function NoteNode({
  id,
  data,
  selected,
}: NodeProps<NoteNodeType>) {
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
        className={`bubble max-w-60 rounded-xl border border-transparent bg-parchment-2 px-4 py-3 ${
          selected ? "bubble-selected border-gold" : ""
        }`}
      >
        {editing ? (
          <NodeEditor
            value={data.content}
            placeholder="A thought of your own…"
            className="w-44 font-serif text-sm italic leading-relaxed text-ink-soft"
            onCommit={(v) => {
              updateNodeData(id, { content: v });
              setEditing(null);
            }}
          />
        ) : (
          <p className="font-serif text-sm italic leading-relaxed text-ink-soft">
            {data.content || (
              <span className="text-ink-muted/60">New note</span>
            )}
          </p>
        )}
        <NodeHandles />
      </div>
    </div>
  );
}
