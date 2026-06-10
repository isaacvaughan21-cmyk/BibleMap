import type { NodeProps } from "@xyflow/react";
import type { VerseNodeType } from "@/lib/types";
import { useCanvasStore } from "@/lib/store/canvas-store";
import NodeHandles from "./NodeHandles";
import NodeEditor from "./NodeEditor";

/** A scripture bubble — gold left border, mono reference, serif verse text. */
export default function VerseNode({
  id,
  data,
  selected,
}: NodeProps<VerseNodeType>) {
  const editing = useCanvasStore((s) => s.editingNodeId) === id;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setEditing = useCanvasStore((s) => s.setEditing);

  return (
    <div
      className={`bubble w-64 rounded-xl border border-l-[3px] border-l-gold bg-parchment px-4 py-3 ${
        selected ? "bubble-selected border-gold" : "border-rule"
      }`}
    >
      {editing ? (
        <NodeEditor
          value={data.verseRef}
          placeholder="e.g. John 3:16"
          singleLine
          className="w-full font-mono text-2xs font-medium uppercase tracking-[0.14em] text-gold"
          onCommit={(v) => {
            updateNodeData(id, { verseRef: v });
            setEditing(null);
          }}
        />
      ) : (
        <p
          className={`font-mono text-2xs font-medium uppercase tracking-[0.14em] ${
            data.verseRef ? "text-gold" : "text-gold/50"
          }`}
        >
          {data.verseRef || "Add reference"}
        </p>
      )}
      {data.verseText && (
        <p className="mt-1.5 font-serif text-sm leading-relaxed text-ink-soft">
          {data.verseText}
        </p>
      )}
      <NodeHandles />
    </div>
  );
}
