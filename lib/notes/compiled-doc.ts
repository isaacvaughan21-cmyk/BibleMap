// Module-scoped hand-off for a freshly compiled StudyDoc. The canvas stashes
// the doc here and navigates to /notes, which reads it back — the same
// non-reactive pattern as crossRefDragPayload in canvas-store.ts, so stashing a
// doc never re-renders the canvas. Peek (not consume): reading it twice (React
// strict-mode double mount, an in-place re-print) returns the same doc.

import type { AIStudyDoc } from "./ai-study-doc";

let compiled: AIStudyDoc | null = null;

export function setCompiledDoc(doc: AIStudyDoc): void {
  compiled = doc;
}

export function getCompiledDoc(): AIStudyDoc | null {
  return compiled;
}
