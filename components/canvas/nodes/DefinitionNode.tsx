"use client";

import { useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import type { DefinitionNodeType } from "@/lib/types";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { lookupDefinitions, type DefinitionCandidate } from "@/lib/dictionary";
import NodeHandles from "./NodeHandles";
import NodeEditor from "./NodeEditor";
import { floatStyle } from "./float";

/**
 * A definition bubble — type a word and Hodos pulls its meaning from a free
 * dictionary. The dictionary returns several senses, so they're offered in a
 * dropdown for the reader to pick the one they mean (the first sense is
 * sometimes archaic). The chosen text is denormalized onto the node so it
 * persists offline. Proper/biblical nouns won't be found; that's shown plainly
 * in the dropdown only — never written into the bubble.
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
  // null = no dropdown; [] = searched, nothing found; [...] = choices.
  const [choices, setChoices] = useState<DefinitionCandidate[] | null>(null);
  const reqId = useRef(0);

  const lookUp = (raw: string) => {
    const word = raw.trim();
    updateNodeData(id, { content: word });
    setEditing(null);
    setChoices(null);
    if (!word) {
      updateNodeData(id, { definition: "" });
      return;
    }
    const mine = ++reqId.current; // ignore a stale lookup if the word changes
    setLooking(true);
    lookupDefinitions(word)
      .then((cands) => {
        if (mine !== reqId.current) return;
        setChoices(cands);
        // Default to the first sense so the bubble isn't blank, but leave the
        // dropdown open so the reader can pick a better-fitting meaning. When
        // nothing is found, never write "not found" into the bubble itself.
        updateNodeData(id, { definition: cands[0]?.text ?? "" });
      })
      .finally(() => {
        if (mine === reqId.current) setLooking(false);
      });
  };

  const pick = (text: string) => {
    updateNodeData(id, { definition: text });
    setChoices(null);
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
            ) : data.definition ? (
              data.definition
            ) : (
              <span className="italic text-ink-muted/70">
                Double-click to look it up.
              </span>
            )}
          </p>
        )}

        {/* Pick-a-meaning dropdown — shown right after a lookup. */}
        {choices && !editing && (
          <div className="nodrag nowheel mt-2 overflow-hidden rounded-lg border border-rule bg-parchment-2 shadow-md shadow-ink/10">
            {choices.length === 0 ? (
              <p className="px-3 py-2 font-serif text-2xs italic text-ink-muted">
                No definition found.
              </p>
            ) : (
              <>
                <p className="px-3 pb-0.5 pt-1.5 font-sans text-[10px] tracking-eyebrow text-ink-muted">
                  PICK A MEANING
                </p>
                {choices.map((c) => (
                  <button
                    key={c.text}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      pick(c.text);
                    }}
                    className={`block w-full px-3 py-1.5 text-left font-serif text-2xs leading-relaxed transition-colors hover:bg-parchment ${
                      c.text === data.definition ? "text-ink" : "text-ink-soft"
                    }`}
                  >
                    {c.text === data.definition && (
                      <span className="mr-1 text-gold">✓</span>
                    )}
                    {c.text}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChoices(null);
                  }}
                  className="block w-full border-t border-rule/60 px-3 py-1 text-left font-sans text-[10px] text-ink-muted transition-colors hover:text-ink"
                >
                  Done
                </button>
              </>
            )}
          </div>
        )}
        <NodeHandles />
      </div>
    </div>
  );
}
