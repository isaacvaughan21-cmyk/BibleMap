/**
 * Shared types for the "Ask Scripture" assistant.
 *
 * This module is import-safe from CLIENT components (AskPanel) — it must never
 * pull in `fs`, the Anthropic SDK, or anything else server-only. Keep it to
 * plain types + the result union the server action returns.
 */

/** How a question was classified before retrieval / answer generation. */
export type Route = "authorship" | "biography" | "topical" | "offtopic";

/** Which half of the canon to search for topical verses. */
export type Testament = "OT" | "NT";

/** A citation whose reference has been verified to resolve in the local corpus. */
export type ValidatedCitation = {
  /** Canonical display reference, e.g. "Ephesians 2:8–9". */
  ref: string;
  /** Authoritative verse text, loaded from the corpus (never the model's quote). */
  text: string;
};

/** One distinct biblical figure in an answer (used for ambiguous names). */
export type FigureBlock = {
  primaryName: string;
  /** Short disambiguating label, e.g. "Mother of Jesus". */
  role: string;
  citations: ValidatedCitation[];
};

export type AskResult =
  | {
      status: "answered";
      route: Route;
      answer: string;
      /** Present (length ≥ 2) only when a name matched several distinct figures. */
      figures?: FigureBlock[];
      citations: ValidatedCitation[];
      /** True when the model was unavailable and a deterministic fallback was used. */
      degraded: boolean;
    }
  | { status: "no_answer"; message: string }
  | { status: "off_topic"; message: string }
  | { status: "invalid"; message: string }
  | { status: "rate_limited" }
  | { status: "error" };
