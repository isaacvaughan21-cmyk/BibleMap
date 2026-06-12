"use client";

import { useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import type { DefinitionNodeType } from "@/lib/types";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { lookupDefinition } from "@/lib/dictionary";
import NodeHandles from "./NodeHandles";
import NodeEditor from "./NodeEditor";
import { floatStyle } from "./float";

const NOT_FOUND = "No definition found.";

/**
 * A definition bubble — type a word and Hodos pulls its meaning from a free
 * dictionary. The looked-up text is denormalized onto the node so it persists
 * offline. Proper/biblical nouns won't be found; that's shown plainly.
 */
export default function DefinitionNode({
  id,
  data,
  selected,
}: NodeProps<DefinitionNodeType>) {
  const editing = useCanvasStore((s) => s.editingNodeId) === id;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const [looking, setLooking] = useState(false);
  const reqId = useRef(0);

  const lookUp = (raw: string) => {
    const word = raw.trim();
    updateNodeData(id, { content: word });
    setEditing(null);
    if (!word) {
      updateNodeData(id, { definition: "" });
      return;
    }
    const mine = ++reqId.current; // ignore a stale lookup if the word changes
    setLooking(true);
    lookupDefinition(word)
      .then((def) => {
        if (mine !== reqId.current) return;
        updateNodeData(id, { definition: def ?? NOT_FOUND });
      })
      .finally(() => {
        if (mine === reqId.current) setLooking(false);
      });
  };

  return (
    <div className={editing ? undefined : "floaty"} style={floatStyle(id)}>
      <div
        className={`bubble w-60 rounded-xl border border-l-[3px] border-l-ink-soft bg-parchment px-4 py-3 ${
          selected ? "bubble-selected border-gold" : "border-rule"
        }`}
      >
        <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
          DEFINITION
        </p>
        {editing ? (
          <NodeEditor
            value={data.content}
            singleLine
            placeholder="A word to define…"
            className="mt-1 w-44 font-serif text-base text-ink"
            onCommit={lookUp}
          />
        ) : (
          <p className="mt-1 font-serif text-base font-medium text-ink">
            {data.content || (
              <span className="font-normal text-ink-muted/60">A word…</span>
            )}
          </p>
        )}
        {data.content && !editing && (
          <p className="mt-1.5 font-serif text-xs leading-relaxed text-ink-soft">
            {looking ? (
              <span className="italic text-ink-muted">Looking it up…</span>
            ) : data.definition === NOT_FOUND ? (
              <span className="italic text-ink-muted">{NOT_FOUND}</span>
            ) : data.definition ? (
              data.definition
            ) : (
              <span className="italic text-ink-muted/70">
                Double-click to look it up.
              </span>
            )}
          </p>
        )}
        <NodeHandles />
      </div>
    </div>
  );
}
