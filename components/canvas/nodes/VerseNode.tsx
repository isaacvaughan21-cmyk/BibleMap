"use client";

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import type { VerseNodeType } from "@/lib/types";
import NodeHandles from "./NodeHandles";
import { floatStyle } from "./float";

const TRUNCATE_AT = 240;

/**
 * A scripture bubble — gold left border, mono reference, serif verse text.
 * Clicking an empty verse bubble opens the verse picker (wired in Canvas).
 * Long passages truncate at 240 chars with an expand affordance.
 */
export default function VerseNode({
  id,
  data,
  selected,
}: NodeProps<VerseNodeType>) {
  const [expanded, setExpanded] = useState(false);
  const isLong = data.verseText.length > TRUNCATE_AT;
  const shown =
    isLong && !expanded
      ? `${data.verseText.slice(0, TRUNCATE_AT).trimEnd()}…`
      : data.verseText;

  return (
    <div className="floaty" style={floatStyle(id)}>
      <div
        className={`bubble w-64 rounded-xl border border-l-[3px] border-l-gold bg-parchment px-4 py-3 ${
          selected ? "bubble-selected border-gold" : "border-rule"
        } ${data.verseRef ? "" : "cursor-pointer hover:border-gold/60"}`}
      >
        <p
          className={`font-mono text-2xs font-medium uppercase tracking-[0.14em] ${
            data.verseRef ? "text-gold" : "text-gold/50"
          }`}
        >
          {data.verseRef || "Choose a verse…"}
        </p>
        {data.verseText && (
          <p className="mt-1.5 font-serif text-sm leading-relaxed text-ink-soft">
            {shown}
            {isLong && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((x) => !x);
                  }}
                  className="nodrag font-sans text-2xs tracking-wide text-gold transition-colors hover:text-ink"
                >
                  {expanded ? "collapse" : "expand"}
                </button>
              </>
            )}
          </p>
        )}
        <NodeHandles />
      </div>
    </div>
  );
}
