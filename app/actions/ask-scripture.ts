"use server";

import { headers } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { askSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { isKnownVersion, DEFAULT_VERSION } from "@/lib/versions";
import { BOOKS } from "@/lib/bible-books";
import { classifyQuery } from "@/lib/qa/route";
import { retrieve } from "@/lib/qa/retriever";
import { validateCitation } from "@/lib/qa/server-bible";
import {
  ASK_SCHEMA,
  GROUNDING_SYSTEM_PROMPT,
  buildUserMessage,
} from "@/lib/qa/prompt";
import type {
  AskResult,
  FigureBlock,
  Route,
  Testament,
  ValidatedCitation,
} from "@/lib/qa/types";

/**
 * "Ask Scripture" — answers a natural-language question grounded ONLY in the
 * local Bible corpus + curated metadata, with every claim backed by a citation
 * that has been re-validated against the corpus. The ANTHROPIC_API_KEY is read
 * server-side only and never reaches the client.
 */

const MODEL = process.env.ANTHROPIC_QA_MODEL ?? "claude-opus-4-8";
const OFF_TOPIC_MESSAGE =
  "I can only answer questions grounded in the Bible. Try asking about a person, a book, or a topic in Scripture.";
const NO_ANSWER_MESSAGE =
  "Scripture, as far as the passages I can draw on here, doesn't directly address that. Try rewording it toward a biblical person, book, or theme.";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return (_client ??= new Anthropic());
}

type ParsedAnswer = {
  answer: string;
  citations?: { index: number; claim?: string }[];
  traditionalAttributions?: {
    subject: string;
    basis: "stated" | "traditional";
  }[];
  notAddressed?: boolean;
  offTopic?: boolean;
  opinionDeflected?: boolean;
};

/** Validate a list of references against the corpus, dropping any that fail. */
async function validateRefs(
  refs: string[],
  version: string,
): Promise<ValidatedCitation[]> {
  const out: ValidatedCitation[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const v = await validateCitation(ref, version);
    if (v && !seen.has(v.ref)) {
      seen.add(v.ref);
      out.push(v);
    }
  }
  return out;
}

/** One grounded model call; null on any error/timeout/parse failure. */
async function callModel(
  question: string,
  candidates: ValidatedCitation[],
  contextLines: string[] | undefined,
  route: Route,
): Promise<ParsedAnswer | null> {
  try {
    const res = (await (
      getClient().messages.create as unknown as (
        ...a: unknown[]
      ) => Promise<Anthropic.Message>
    )(
      {
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: "adaptive" },
        output_config: {
          effort: route === "topical" ? "medium" : "low",
          format: { type: "json_schema", schema: ASK_SCHEMA },
        },
        system: GROUNDING_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserMessage(question, candidates, contextLines),
          },
        ],
      },
      { signal: AbortSignal.timeout(20_000) },
    )) as Anthropic.Message;

    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    return JSON.parse(textBlock.text) as ParsedAnswer;
  } catch (err) {
    console.error("[ask-scripture] model call failed:", err);
    return null;
  }
}

/** Map the model's index citations back to the (pre-validated) candidate set. */
function citationsFromIndices(
  parsed: ParsedAnswer,
  candidates: ValidatedCitation[],
): ValidatedCitation[] {
  const out: ValidatedCitation[] = [];
  const seen = new Set<string>();
  for (const c of parsed.citations ?? []) {
    const cand = candidates[c.index - 1]; // 1-based in the prompt
    if (!cand || seen.has(cand.ref)) continue;
    seen.add(cand.ref);
    out.push(cand);
  }
  return out;
}

function bookName(code: string): string {
  return BOOKS.find((b) => b.code === code)?.name ?? code;
}

export async function askScripture(input: {
  question: string;
  version?: string;
  /** Which testament to search for topical verses (default New). */
  testament?: Testament;
}): Promise<AskResult> {
  // 1. Validate input.
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "That doesn't look right.",
    };
  }
  const question = parsed.data.question;
  const version =
    input.version && isKnownVersion(input.version)
      ? input.version
      : DEFAULT_VERSION;
  // Topical verse search is scoped to a testament; default New.
  const testament: Testament = input.testament === "OT" ? "OT" : "NT";

  // 2. Rate-limit per hashed IP. A study assistant is conversational, so this is
  //    much more generous than the feedback form's 5/10min — it only blunts
  //    runaway abuse (a question every ~6s sustained is fine).
  const ipHash = hashIp(getClientIp(headers()));
  if (
    !checkRateLimit(`ask:${ipHash}`, { max: 20, windowMs: 2 * 60 * 1000 }).ok
  ) {
    return { status: "rate_limited" };
  }

  // 3. Classify.
  const cls = classifyQuery(question);

  if (cls.route === "offtopic") {
    return { status: "off_topic", message: OFF_TOPIC_MESSAGE };
  }

  try {
    // 4. Assemble evidence per route.
    let candidates: ValidatedCitation[] = [];
    let contextLines: string[] | undefined;
    let figureRefs: ValidatedCitation[][] = []; // biography: per-figure citations

    if (cls.route === "authorship" && cls.bookHits?.length) {
      const meta = cls.bookHits[0];
      contextLines = [
        `Book: ${bookName(meta.code)}.`,
        `Author (per this app): ${meta.author} — authorship is ${meta.attribution} in the text.`,
        ...(meta.audience ? [`Audience: ${meta.audience}.`] : []),
        meta.summary,
      ];
      candidates = await validateRefs(
        [...meta.authorEvidenceRefs, ...(meta.audienceRefs ?? [])],
        version,
      );
    } else if (cls.route === "biography" && cls.personHits?.length) {
      contextLines = cls.personHits.map(
        (p) => `${p.primaryName} (${p.role}): ${p.summary}`,
      );
      figureRefs = await Promise.all(
        cls.personHits.map((p) => validateRefs(p.keyRefs, version)),
      );
      candidates = dedupeCitations(figureRefs.flat());
    } else {
      // Topical (or a metadata route that produced no usable refs).
      candidates = await retrieve(question, version, testament);
      if (candidates.length === 0) {
        const otherName = testament === "NT" ? "Old" : "New";
        const thisName = testament === "NT" ? "New" : "Old";
        return {
          status: "no_answer",
          message: `I couldn't find ${thisName} Testament passages on that. Try the ${otherName} Testament with the toggle, or reword your question.`,
        };
      }
    }

    // 5. Grounded generation. Skipped entirely when no API key is configured —
    // the fallback below answers from retrieved verses + curated metadata, so
    // the assistant is useful without a key (topical = the verses that match).
    const hasModel = !!process.env.ANTHROPIC_API_KEY;
    const answer = hasModel
      ? await callModel(question, candidates, contextLines, cls.route)
      : null;

    // 5b. No model (key absent or call failed) — never hard-fail.
    if (!answer) {
      const fallback = deterministicFallback(
        cls,
        candidates,
        question,
        figureRefs,
      );
      if (fallback) return fallback;
      return { status: "error" };
    }

    if (answer.offTopic) {
      return { status: "off_topic", message: OFF_TOPIC_MESSAGE };
    }

    // 6. Resolve citations + assemble the result.
    if (cls.route === "biography" && (cls.personHits?.length ?? 0) > 1) {
      // Ambiguous name → distinct figure cards, each with its own verses.
      const figures: FigureBlock[] = cls
        .personHits!.map((p, i) => ({
          primaryName: p.primaryName,
          role: p.role,
          citations: figureRefs[i] ?? [],
        }))
        .filter((f) => f.citations.length > 0);
      // notAddressed is not honored here — a matched figure is always grounded.
      if (figures.length === 0) {
        return { status: "no_answer", message: NO_ANSWER_MESSAGE };
      }
      return {
        status: "answered",
        route: cls.route,
        answer: answer.answer,
        figures,
        citations: [],
        degraded: false,
      };
    }

    // Authorship / single-figure biography use the curated citation set;
    // topical uses the model's index-selected subset.
    const citations =
      cls.route === "topical"
        ? citationsFromIndices(answer, candidates)
        : candidates;

    // Only topical answers are downgraded — authorship/biography are grounded in
    // curated metadata, so a model "notAddressed" flag there is spurious.
    if (
      cls.route === "topical" &&
      (answer.notAddressed || citations.length === 0)
    ) {
      return { status: "no_answer", message: NO_ANSWER_MESSAGE };
    }

    return {
      status: "answered",
      route: cls.route,
      answer: answer.answer,
      citations,
      degraded: false,
    };
  } catch (err) {
    console.error("[ask-scripture] unexpected error:", err);
    return { status: "error" };
  }
}

function dedupeCitations(list: ValidatedCitation[]): ValidatedCitation[] {
  const seen = new Set<string>();
  const out: ValidatedCitation[] = [];
  for (const c of list) {
    if (seen.has(c.ref)) continue;
    seen.add(c.ref);
    out.push(c);
  }
  return out;
}

/** Pull a concise topic phrase from a topical question, or null if unclear. */
function extractTopic(question: string): string | null {
  let t = question
    .trim()
    .toLowerCase()
    .replace(/[?.!]+$/, "")
    .trim();
  const leads = [
    /^(?:what (?:does|do|did|can|should)|what's|what is|how does|where does|where in the bible does)\s+(?:the\s+)?(?:bible|scripture|scriptures|word of god|god|jesus|lord)\s+(?:say|teach|tell us|have to say|reveal|talk)\s+(?:about|on|regarding|concerning)\s+/,
    /^(?:verses?|passages?|scriptures?|anything|something|what)\s+(?:about|on|regarding|concerning)\s+/,
    /^(?:tell me about|what about|about)\s+/,
  ];
  let matched = false;
  for (const re of leads) {
    if (re.test(t)) {
      t = t.replace(re, "").trim();
      matched = true;
      break;
    }
  }
  t = t.replace(/\s+(?:in|according to)\s+the\s+bible$/, "").trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (matched && words.length >= 1 && words.length <= 6) return t;
  if (!matched && words.length <= 3 && t.length > 1) return t;
  return null;
}

/**
 * Answer without the model: authorship/biography from curated facts, and
 * topical from the retrieved verses themselves (the no-API-key topical answer).
 */
function deterministicFallback(
  cls: ReturnType<typeof classifyQuery>,
  candidates: ValidatedCitation[],
  question: string,
  figureRefs: ValidatedCitation[][],
): AskResult | null {
  if (cls.route === "authorship" && cls.bookHits?.length) {
    const meta = cls.bookHits[0];
    const name = bookName(meta.code);
    const isUnknown = meta.author.toLowerCase().startsWith("unknown");
    const lede = isUnknown
      ? ""
      : meta.attribution === "stated"
        ? `${name} is attributed to ${meta.author}, who is named in the text. `
        : `${name} is traditionally attributed to ${meta.author}; the book itself does not name its author. `;
    const audience = meta.audience
      ? `It was written to ${meta.audience}. `
      : "";
    return {
      status: "answered",
      route: "authorship",
      answer: `${lede}${audience}${meta.summary}`.trim(),
      citations: candidates,
      degraded: true,
    };
  }
  if (cls.route === "biography" && cls.personHits?.length) {
    if (cls.personHits.length > 1) {
      const figures: FigureBlock[] = cls.personHits
        .map((p, i) => ({
          primaryName: p.primaryName,
          role: p.role,
          citations: figureRefs[i] ?? [],
        }))
        .filter((f) => f.citations.length > 0);
      const intro = `The Bible names more than one ${cls.personHits[0].primaryName}. Here are the distinct figures:`;
      return {
        status: "answered",
        route: "biography",
        answer: intro,
        figures,
        citations: [],
        degraded: true,
      };
    }
    const p = cls.personHits[0];
    return {
      status: "answered",
      route: "biography",
      answer: p.summary,
      citations: candidates,
      degraded: true,
    };
  }

  // Topical (or any route that fell through to retrieval): hand back the verses
  // that match, with a short framing. This is the no-API-key topical answer.
  if (candidates.length > 0) {
    const topic = extractTopic(question);
    const answer = topic
      ? `Here are passages from Scripture that speak about ${topic}. Read them in context to see what the Bible says.`
      : "Here are passages from Scripture that relate to your question — read them in context to see what it says.";
    return {
      status: "answered",
      route: "topical",
      answer,
      citations: candidates,
      degraded: true,
    };
  }
  return null;
}
