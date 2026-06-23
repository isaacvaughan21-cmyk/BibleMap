// lib/notes/ai-study-doc.ts — the AI study-notes output CONTRACT.
//
// This Zod schema drives server-side VALIDATION of the model's response and the
// AIStudyDoc TypeScript type the renderer consumes (z.infer). The API contract
// sent to Claude is the hand-authored AI_STUDY_DOC_SCHEMA literal at the bottom
// of this file — kept field-for-field in lockstep with the Zod schema (the route
// validates against the Zod schema, so any drift fails at runtime). Both live in
// this one file so they move together.
//
// Every text fragment carries a `source`/`via`/`confidence` tag so the renderer
// can visually separate the USER'S OWN WORDS from AI-added explanation. Optional
// fields are `.nullable()` (a value is always present, possibly null) — the
// structured-output-friendly shape. The SDK strips unsupported JSON-schema
// constraints automatically.

import { z } from "zod";

const crossRef = z
  .object({
    reference: z
      .string()
      .describe(
        "The cross-referenced passage reference. REFERENCE ONLY — never quoted text.",
      ),
    via: z
      .enum(["crossref_edge", "manual_edge", "ai_connection"])
      .describe(
        "crossref_edge/manual_edge = present in the user's graph; ai_connection = AI-proposed (use sparingly).",
      ),
    targetNodeId: z
      .string()
      .nullable()
      .describe(
        "Target verse bubble id when this cross-ref is a graph edge to a node in this map; null otherwise.",
      ),
    note: z
      .string()
      .nullable()
      .describe(
        "One short AI clause on why it connects; null if self-evident.",
      ),
  })
  .describe("A scripture cross-reference.");

const keyWord = z
  .object({
    word: z.string().describe("The word/term, verbatim."),
    userDefinition: z
      .string()
      .nullable()
      .describe(
        "The user's own looked-up meaning from a definition bubble, verbatim. AUTHORITATIVE — never override. Null if none.",
      ),
    aiGloss: z
      .string()
      .nullable()
      .describe(
        "A conservative AI gloss, only when it ADDS to (never contradicts) any userDefinition. Null when unsure or already covered.",
      ),
    confidence: z
      .enum(["standard", "tentative"])
      .describe("'tentative' for any debatable lexical claim."),
    definitionNodeId: z
      .string()
      .nullable()
      .describe("Originating definition bubble id, if any; else null."),
  })
  .describe("A conservative word/term study.");

const passage = z
  .object({
    nodeId: z
      .string()
      .describe("MUST equal the verse bubble's id from the input."),
    reference: z
      .string()
      .describe(
        "Canonical reference exactly as provided (e.g. 'John 3:16'). Never invent or correct a reference.",
      ),
    verseText: z
      .string()
      .nullable()
      .describe(
        "The verse text VERBATIM from the bubble, or null if the bubble had none. NEVER supply text from memory.",
      ),
    verseTextSource: z
      .enum(["user", "absent"])
      .describe("'user' iff verseText came from the bubble; else 'absent'."),
    highlights: z
      .array(z.string())
      .describe(
        "The user's marked phrases, copied verbatim. Empty array if none.",
      ),
    keyWords: z.array(keyWord),
    crossRefs: z.array(crossRef),
  })
  .describe("Per-verse anatomy for one verse bubble.");

const sourcedLine = z.object({
  text: z.string(),
  source: z
    .enum(["user_verbatim", "ai_explanation", "ai_connection"])
    .describe(
      "user_verbatim = the bubble's own words; ai_* = labeled AI commentary.",
    ),
  nodeId: z
    .string()
    .nullable()
    .describe(
      "Originating bubble id when source=user_verbatim; null for AI lines.",
    ),
});

const subsection = z
  .object({
    nodeId: z
      .string()
      .describe("The branch bubble's id. MUST exist in the input."),
    heading: z.string(),
    headingSource: z.enum(["user_verbatim", "user_cleaned"]),
    points: z
      .array(sourcedLine)
      .describe(
        "Leaf points. Graph descendants deeper than this level are FLATTENED here, each keeping its own nodeId.",
      ),
    depthCollapsed: z
      .boolean()
      .describe(
        "true iff deeper-than-2 graph descendants were flattened into points.",
      ),
  })
  .describe("One branch bubble under a top-level bubble.");

const section = z
  .object({
    nodeId: z
      .string()
      .describe(
        "The top-level bubble's id. MUST exist in the input. Sections are NEVER synthesized.",
      ),
    heading: z
      .string()
      .describe(
        "Header text. Use the bubble's own wording (lightly cleaned); never invent a topic the bubble doesn't state.",
      ),
    headingSource: z
      .enum(["user_verbatim", "user_cleaned"])
      .describe(
        "'user_cleaned' only for capitalization/trailing-punctuation tidy-ups.",
      ),
    anchorRef: z
      .string()
      .nullable()
      .describe(
        "If this section's bubble is a verse, its reference; else null.",
      ),
    observations: z.array(sourcedLine),
    subsections: z
      .array(subsection)
      .describe("ONE per branch bubble under this top-level bubble."),
  })
  .describe("A top-level section, mapped 1:1 from a root bubble.");

const looseBubble = z.object({
  nodeId: z.string(),
  kind: z.enum(["question", "note", "definition", "other"]),
  label: z.string().describe("Display label, e.g. 'Note', 'Definition'."),
  text: z
    .string()
    .describe(
      "The bubble's content VERBATIM (for a definition, 'term — meaning').",
    ),
  triage: z
    .enum(["insight", "question", "application", "unsorted"])
    .describe("Swedish-method bucket inferred from the bubble's nature only."),
  aiNote: z
    .string()
    .nullable()
    .describe(
      "Optional one-line AI orientation; null when the bubble speaks for itself.",
    ),
});

const openQuestion = z.object({
  nodeId: z.string(),
  question: z.string().describe("The question VERBATIM."),
  aiAngle: z
    .string()
    .nullable()
    .describe(
      "Optional reframing or what-to-look-for hint — NOT an answer. Null to leave open.",
    ),
});

const takeaway = z.object({
  text: z.string(),
  source: z
    .enum(["user_verbatim", "ai_application"])
    .describe(
      "user_verbatim when an application bubble exists; ai_application for AI-suggested.",
    ),
  nodeId: z.string().nullable(),
});

export const aiStudyDocSchema = z
  .object({
    title: z
      .string()
      .describe(
        "Document title. Use the map name verbatim if meaningful; else a faithful summary.",
      ),
    focus: z.object({
      statement: z
        .string()
        .describe(
          "One sentence naming the single dominant idea the map circles around. Grounded in the bubbles.",
        ),
      source: z
        .literal("ai_synthesis")
        .describe(
          "Always ai_synthesis — the focus is the only synthesized header allowed.",
        ),
    }),
    passages: z.array(passage),
    sections: z.array(section),
    looseBubbles: z.array(looseBubble),
    openQuestions: z.array(openQuestion),
    application: z.object({
      takeaways: z.array(takeaway),
      source: z.enum(["ai_synthesis", "user_grounded", "mixed"]),
    }),
    prayer: z
      .string()
      .nullable()
      .describe(
        "Optional short prayer flowing from the focus. Null over filler.",
      ),
    meta: z.object({
      nodeCount: z
        .number()
        .int()
        .describe(
          "Total input bubbles you were given (copy the count from the input).",
        ),
      coverageNote: z
        .string()
        .nullable()
        .describe(
          "One honest line if the map was too sparse/ambiguous to fully structure; else null.",
        ),
      omittedNodeIds: z
        .array(z.string())
        .describe(
          "Input node ids you could not place. Should be empty; the server cross-checks.",
        ),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  })
  .describe(
    "A structured Bible-study notes document compiled from a mind-map.",
  );

export type AIStudyDoc = z.infer<typeof aiStudyDocSchema>;

// ---------------------------------------------------------------------------
// Structured-output JSON schema — the API contract sent to Claude.
//
// Hand-authored (rather than derived from the Zod schema) because the installed
// @anthropic-ai/sdk's zod helper targets a different Zod major than the project
// pins. Kept field-for-field in lockstep with `aiStudyDocSchema` above, which
// the route uses to VALIDATE the response — so any drift fails validation at
// runtime. Structured-output-safe: additionalProperties:false on every object,
// every property in `required`, optionality via ["…","null"], no min/max/format.
// ---------------------------------------------------------------------------
const NULLABLE_STRING = { type: ["string", "null"] };

const SOURCED_LINE = {
  type: "object",
  additionalProperties: false,
  required: ["text", "source", "nodeId"],
  properties: {
    text: { type: "string" },
    source: {
      type: "string",
      enum: ["user_verbatim", "ai_explanation", "ai_connection"],
      description:
        "user_verbatim = the bubble's own words; ai_* = labeled AI commentary.",
    },
    nodeId: {
      ...NULLABLE_STRING,
      description:
        "Originating bubble id when source=user_verbatim; null for AI lines.",
    },
  },
};

export const AI_STUDY_DOC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "focus",
    "passages",
    "sections",
    "looseBubbles",
    "openQuestions",
    "application",
    "prayer",
    "meta",
  ],
  properties: {
    title: {
      type: "string",
      description: "Document title; the map name verbatim if meaningful.",
    },
    focus: {
      type: "object",
      additionalProperties: false,
      required: ["statement", "source"],
      properties: {
        statement: {
          type: "string",
          description:
            "One sentence naming the single dominant idea the map circles around.",
        },
        source: { type: "string", enum: ["ai_synthesis"] },
      },
    },
    passages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "nodeId",
          "reference",
          "verseText",
          "verseTextSource",
          "highlights",
          "keyWords",
          "crossRefs",
        ],
        properties: {
          nodeId: {
            type: "string",
            description: "MUST equal the verse bubble's id from the input.",
          },
          reference: {
            type: "string",
            description:
              "Canonical reference exactly as provided. Never invent or correct it.",
          },
          verseText: {
            ...NULLABLE_STRING,
            description:
              "Verse text VERBATIM from the bubble, or null. NEVER supply from memory.",
          },
          verseTextSource: { type: "string", enum: ["user", "absent"] },
          highlights: { type: "array", items: { type: "string" } },
          keyWords: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "word",
                "userDefinition",
                "aiGloss",
                "confidence",
                "definitionNodeId",
              ],
              properties: {
                word: { type: "string" },
                userDefinition: {
                  ...NULLABLE_STRING,
                  description:
                    "User's own meaning, verbatim. AUTHORITATIVE — never override.",
                },
                aiGloss: {
                  ...NULLABLE_STRING,
                  description:
                    "Conservative AI gloss only when it ADDS to userDefinition; else null.",
                },
                confidence: { type: "string", enum: ["standard", "tentative"] },
                definitionNodeId: NULLABLE_STRING,
              },
            },
          },
          crossRefs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["reference", "via", "targetNodeId", "note"],
              properties: {
                reference: {
                  type: "string",
                  description: "Reference ONLY — never quoted text.",
                },
                via: {
                  type: "string",
                  enum: ["crossref_edge", "manual_edge", "ai_connection"],
                },
                targetNodeId: NULLABLE_STRING,
                note: NULLABLE_STRING,
              },
            },
          },
        },
      },
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "nodeId",
          "heading",
          "headingSource",
          "anchorRef",
          "observations",
          "subsections",
        ],
        properties: {
          nodeId: {
            type: "string",
            description:
              "The top-level bubble's id. MUST exist in the input. Sections are NEVER synthesized.",
          },
          heading: {
            type: "string",
            description:
              "Use the bubble's own wording (lightly cleaned). Never invent a topic.",
          },
          headingSource: {
            type: "string",
            enum: ["user_verbatim", "user_cleaned"],
          },
          anchorRef: NULLABLE_STRING,
          observations: { type: "array", items: SOURCED_LINE },
          subsections: {
            type: "array",
            description: "ONE per branch bubble under this top-level bubble.",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "nodeId",
                "heading",
                "headingSource",
                "points",
                "depthCollapsed",
              ],
              properties: {
                nodeId: {
                  type: "string",
                  description:
                    "The branch bubble's id. MUST exist in the input.",
                },
                heading: { type: "string" },
                headingSource: {
                  type: "string",
                  enum: ["user_verbatim", "user_cleaned"],
                },
                points: {
                  type: "array",
                  items: SOURCED_LINE,
                  description:
                    "Leaf points; deeper descendants flattened here, each keeping its nodeId.",
                },
                depthCollapsed: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    looseBubbles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nodeId", "kind", "label", "text", "triage", "aiNote"],
        properties: {
          nodeId: { type: "string" },
          kind: {
            type: "string",
            enum: ["question", "note", "definition", "other"],
          },
          label: { type: "string" },
          text: {
            type: "string",
            description: "The bubble's content VERBATIM.",
          },
          triage: {
            type: "string",
            enum: ["insight", "question", "application", "unsorted"],
          },
          aiNote: NULLABLE_STRING,
        },
      },
    },
    openQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nodeId", "question", "aiAngle"],
        properties: {
          nodeId: { type: "string" },
          question: { type: "string", description: "The question VERBATIM." },
          aiAngle: {
            ...NULLABLE_STRING,
            description:
              "Optional reframing/what-to-look-for — NOT an answer. Null to leave open.",
          },
        },
      },
    },
    application: {
      type: "object",
      additionalProperties: false,
      required: ["takeaways", "source"],
      properties: {
        takeaways: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text", "source", "nodeId"],
            properties: {
              text: { type: "string" },
              source: {
                type: "string",
                enum: ["user_verbatim", "ai_application"],
              },
              nodeId: NULLABLE_STRING,
            },
          },
        },
        source: {
          type: "string",
          enum: ["ai_synthesis", "user_grounded", "mixed"],
        },
      },
    },
    prayer: {
      ...NULLABLE_STRING,
      description:
        "Optional short prayer flowing from the focus. Null over filler.",
    },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["nodeCount", "coverageNote", "omittedNodeIds", "confidence"],
      properties: {
        nodeCount: {
          type: "integer",
          description:
            "Total input bubbles you were given (copy from the input).",
        },
        coverageNote: {
          ...NULLABLE_STRING,
          description:
            "One honest line if the map was too sparse to fully structure; else null.",
        },
        omittedNodeIds: { type: "array", items: { type: "string" } },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
    },
  },
} satisfies Record<string, unknown>;
export type AIPassage = z.infer<typeof passage>;
export type AISection = z.infer<typeof section>;
export type AISubsection = z.infer<typeof subsection>;
export type AISourcedLine = z.infer<typeof sourcedLine>;
export type AILooseBubble = z.infer<typeof looseBubble>;
export type AIOpenQuestion = z.infer<typeof openQuestion>;
export type AICrossRef = z.infer<typeof crossRef>;
export type AIKeyWord = z.infer<typeof keyWord>;
export type AITakeaway = z.infer<typeof takeaway>;
