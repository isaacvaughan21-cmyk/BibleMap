import type { CSSProperties } from "react";

/**
 * Ambient drift per bubble — amplitude/duration/phase staggered by node id so
 * the canvas never moves in lockstep (same language as the landing hero).
 */
export function floatStyle(id: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return {
    "--float-amp": "2.5px",
    "--float-dur": `${5.2 + (h % 5) * 0.55}s`,
    animationDelay: `${-(h % 9) * 0.7}s`,
  } as CSSProperties;
}
