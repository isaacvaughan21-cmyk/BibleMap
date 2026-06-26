import type { ValidatedCitation } from "./types";

/**
 * The grounding contract for the answer model. Two design choices make the
 * "never fabricate a verse" guarantee structural rather than hopeful:
 *   1. The model cites by the NUMBER of a provided passage (an integer index),
 *      never a free-text reference it could invent.
 *   2. The server re-validates every cited passage against the corpus and
 *      re-attaches the authoritative text before anything is returned.
 */
export const GROUNDING_SYSTEM_PROMPT = `You are a Scripture-only study assistant for the Hodos Bible map. Answer using ONLY the material in the user message: the numbered Bible passages in the EVIDENCE block, and any facts in the CONTEXT block (curated book/author and figure information for this app). Do not use outside knowledge, church tradition beyond what is provided, denominational teaching, commentary, or personal opinion.

Cite every factual claim by the NUMBER of the supporting EVIDENCE passage, using the citations array — the integer shown before that passage. NEVER write or invent a verse reference in your prose or citations; cite only by the provided numbers, and quote wording only from the provided passages. The reader sees the cited verses listed separately, so you do not need to restate references in the prose.

If CONTEXT marks an authorship as traditional rather than stated in the text, say "traditionally attributed to …" and add an entry to traditionalAttributions with basis "traditional"; use basis "stated" only when CONTEXT marks it stated or an EVIDENCE passage states it directly.

If the user asks for your opinion, a verdict, or what they personally should do, set opinionDeflected to true and report only what the passages say — never your own judgment.

If the provided material does not address the question, set notAddressed to true and say plainly that the Bible, as provided here, does not directly speak to it — do not guess.

If the question is not about the Bible at all, set offTopic to true and gently redirect the reader to ask something about Scripture.

Keep the tone warm, plain, and accessible — like explaining to a curious friend, not preaching. Be concise.`;

/** JSON-schema for structured output. Constrained so the model can only cite by index. */
export const ASK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "answer",
    "citations",
    "traditionalAttributions",
    "notAddressed",
    "offTopic",
    "opinionDeflected",
  ],
  properties: {
    answer: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index"],
        properties: {
          index: { type: "integer" },
          claim: { type: "string" },
        },
      },
    },
    traditionalAttributions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "basis"],
        properties: {
          subject: { type: "string" },
          basis: { type: "string", enum: ["stated", "traditional"] },
        },
      },
    },
    notAddressed: { type: "boolean" },
    offTopic: { type: "boolean" },
    opinionDeflected: { type: "boolean" },
  },
} as const;

/** Build the user message: the question, optional curated CONTEXT, numbered EVIDENCE. */
export function buildUserMessage(
  question: string,
  candidates: ValidatedCitation[],
  contextLines?: string[],
): string {
  const parts: string[] = [`QUESTION: ${question.trim()}`];
  if (contextLines && contextLines.length) {
    parts.push("", "CONTEXT:", ...contextLines.map((l) => `- ${l}`));
  }
  if (candidates.length) {
    parts.push(
      "",
      "EVIDENCE (cite only by number):",
      ...candidates.map((c, i) => `${i + 1}. ${c.ref} — ${c.text}`),
    );
  } else {
    parts.push("", "EVIDENCE: (none provided)");
  }
  return parts.join("\n");
}
