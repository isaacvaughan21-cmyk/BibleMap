import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServiceClient } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";
import type { OutlineGraph } from "@/lib/notes/outline";
import {
  AI_NOTES_MODEL,
  AI_NOTES_SYSTEM_PROMPT,
  AI_STUDY_DOC_SCHEMA,
  MAX_NODES,
  MAX_OUTPUT_TOKENS,
  MAX_TOTAL_CHARS,
  aiStudyDocSchema,
  buildAiNotesUserMessage,
} from "@/lib/notes/ai-notes-shared";

/**
 * POST /api/ai-notes — generate AI study notes from a map's resolved hierarchy.
 *
 * Signed-in Supabase users only (identity comes from the validated JWT, NEVER
 * the body). Admins (HODOS_ADMIN_EMAILS) are unlimited; everyone else gets a
 * lifetime free trial (HODOS_AI_FREE_GENERATIONS) metered by the ai_usage table.
 * Input size is capped before the model is called, so a single request can't run
 * up an unbounded bill. Usage is recorded only on success.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrBody = { error: { code: string; message: string } } & Record<
  string,
  unknown
>;

function err(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse<ErrBody> {
  return NextResponse.json({ error: { code, message }, ...extra }, { status });
}

function adminEmails(): Set<string> {
  const raw = process.env.HODOS_ADMIN_EMAILS ?? "isaacvaughan21@gmail.com";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function freeLimit(): number {
  const n = Number.parseInt(process.env.HODOS_AI_FREE_GENERATIONS ?? "5", 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

/** Walk the posted OutlineGraph collecting every node id (iterative, cycle-safe). */
function collectInputIds(body: unknown): Set<string> {
  const ids = new Set<string>();
  const roots = (body as { roots?: unknown })?.roots;
  const orphans = (body as { orphans?: unknown })?.orphans;
  const stack: unknown[] = [];
  if (Array.isArray(roots)) stack.push(...roots);
  if (Array.isArray(orphans)) stack.push(...orphans);
  let guard = 0;
  while (stack.length && guard++ < 100_000) {
    const node = stack.pop() as { id?: unknown; children?: unknown } | null;
    if (!node || typeof node !== "object") continue;
    if (typeof node.id === "string") ids.add(node.id);
    if (Array.isArray(node.children)) stack.push(...node.children);
  }
  return ids;
}

/**
 * GET — config diagnostic. Returns ONLY booleans (never any secret value) so you
 * can confirm, in a browser, whether this deployment actually received the env
 * vars. Open this URL on the deployment you're testing; if anthropicKeyPresent
 * is false, the key isn't reaching this build (wrong env scope, or not redeployed
 * since it was added). Gated behind the app flag like everything else.
 */
export async function GET(): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_HODOS_APP_ENABLED !== "true") {
    return err(404, "not_found", "Not found.");
  }
  return NextResponse.json({
    ok: true,
    model: AI_NOTES_MODEL,
    anthropicKeyPresent: !!process.env.ANTHROPIC_API_KEY,
    supabaseConfigured:
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    adminEmailsConfigured: !!process.env.HODOS_ADMIN_EMAILS,
    freeGenerationsConfigured: !!process.env.HODOS_AI_FREE_GENERATIONS,
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  // (0) App-flag gate — match the /app + /notes feature flag.
  if (process.env.NEXT_PUBLIC_HODOS_APP_ENABLED !== "true") {
    return err(404, "not_found", "Not found.");
  }

  // (1) Auth — identity comes from the validated Supabase JWT only.
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) {
    return err(401, "not_signed_in", "Sign in to generate AI study notes.");
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch {
    return err(
      503,
      "server_unconfigured",
      "Notes are temporarily unavailable.",
    );
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    return err(401, "invalid_session", "Your session expired. Sign in again.");
  }
  const user = userData.user;
  const email = (user.email ?? "").toLowerCase();

  // (2) Rate limit — keyed on the validated user id.
  const rl = checkRateLimit(`ai-notes:${user.id}`);
  if (!rl.ok) {
    return err(
      429,
      "rate_limited",
      "You're going a bit fast — try again shortly.",
      {
        retryAfterMs: rl.retryAfterMs,
      },
    );
  }

  // (3) Body + size caps.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "bad_request", "Malformed request.");
  }
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { roots?: unknown }).roots) ||
    !Array.isArray((body as { orphans?: unknown }).orphans)
  ) {
    return err(400, "bad_request", "Missing or malformed map.");
  }
  const inputIds = collectInputIds(body);
  const nodeCount = inputIds.size;
  if (nodeCount === 0) {
    return err(
      400,
      "empty_map",
      "Add a few bubbles first — nothing to turn into notes.",
    );
  }
  if (nodeCount > MAX_NODES) {
    return err(
      413,
      "map_too_large",
      `This map has ${nodeCount} bubbles; the limit is ${MAX_NODES}. Split it across maps.`,
    );
  }
  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_TOTAL_CHARS) {
    return err(
      413,
      "map_too_large",
      "This map is too large to summarize in one pass. Split it into smaller maps.",
    );
  }

  // (4) Admin vs lifetime quota.
  const isAdmin = !!email && adminEmails().has(email);
  const limit = freeLimit();
  if (!isAdmin) {
    const { count, error: countErr } = await supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (countErr) {
      console.error("[ai-notes] usage count error:", countErr.message);
      return err(503, "server_error", "Couldn't check your usage. Try again.");
    }
    if ((count ?? 0) >= limit) {
      return err(
        402,
        "quota_exhausted",
        `You've used all ${limit} free AI notes. More coming soon.`,
        { remaining: 0, limit },
      );
    }
  }

  // (5) API key.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[ai-notes] ANTHROPIC_API_KEY is not set.");
    return err(
      503,
      "ai_unconfigured",
      "AI notes aren't switched on yet. Check back soon.",
    );
  }

  // (6) Call Claude (structured output, prompt-cached system prompt).
  const anthropic = new Anthropic({ apiKey });
  const mapName =
    typeof (body as { title?: unknown }).title === "string"
      ? (body as { title: string }).title.slice(0, 200)
      : "Study";

  let message;
  try {
    message = await anthropic.messages.create({
      model: AI_NOTES_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          schema: AI_STUDY_DOC_SCHEMA as Record<string, unknown>,
        },
      },
      system: [
        {
          type: "text",
          text: AI_NOTES_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildAiNotesUserMessage(body as unknown as OutlineGraph),
        },
      ],
    });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    const detail = (e as Error)?.message ?? String(e);
    console.error("[ai-notes] Claude error:", status, detail);
    if (status === 429 || status === 529) {
      return err(
        503,
        "ai_busy",
        "The notes engine is busy right now — try again in a moment.",
      );
    }
    // TEMP DEBUG (preview only): echo the upstream status + message so the cause
    // is visible without digging through Vercel logs. Removed before merge.
    return err(
      502,
      "ai_error",
      `Couldn't generate notes (${status ?? "?"}): ${String(detail).slice(0, 300)}`,
    );
  }

  // (7) Extract + validate.
  if (message.stop_reason === "refusal") {
    return err(
      422,
      "refused",
      "The notes engine declined this content. Edit your map and retry.",
    );
  }
  if (message.stop_reason === "max_tokens") {
    return err(
      502,
      "ai_truncated",
      "Your map produced more notes than fit in one pass. Try splitting it.",
    );
  }
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("[ai-notes] no text block in response.");
    return err(
      502,
      "ai_error",
      "Couldn't read the generated notes. Please try again.",
    );
  }
  let rawDoc: unknown;
  try {
    rawDoc = JSON.parse(textBlock.text);
  } catch {
    console.error("[ai-notes] response was not valid JSON.");
    return err(
      502,
      "ai_error",
      "Couldn't read the generated notes. Please try again.",
    );
  }
  const validated = aiStudyDocSchema.safeParse(rawDoc);
  if (!validated.success) {
    console.error(
      "[ai-notes] schema validation failed:",
      validated.error.issues[0]?.message,
    );
    return err(
      502,
      "ai_error",
      "Couldn't read the generated notes. Please try again.",
    );
  }
  const doc = validated.data;

  // Coverage: every structural nodeId MUST be a real input id (guardrail 3).
  const structuralIds: string[] = [
    ...doc.sections.map((s) => s.nodeId),
    ...doc.sections.flatMap((s) => s.subsections.map((ss) => ss.nodeId)),
    ...doc.passages.map((p) => p.nodeId),
  ];
  if (structuralIds.some((id) => !inputIds.has(id))) {
    console.error("[ai-notes] model emitted a fabricated structural nodeId.");
    return err(
      502,
      "ai_error",
      "Couldn't read the generated notes. Please try again.",
    );
  }
  // Server is authoritative for the node count (drives the empty-state guard).
  doc.meta.nodeCount = nodeCount;

  // (8) Record usage on success (never fail the request on a log error).
  try {
    // supabase-js returns DB errors as a value (not a throw) — capture it so a
    // persistent insert regression (RLS/trigger/NOT NULL) stays observable
    // instead of silently making the free trial unlimited.
    const { error: insertErr } = await supabase.from("ai_usage").insert({
      user_id: user.id,
      model: AI_NOTES_MODEL,
      map_name: mapName,
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
    });
    if (insertErr) {
      console.error(
        "[ai-notes] usage insert failed (non-fatal):",
        insertErr.message,
      );
    }
  } catch (e) {
    console.error(
      "[ai-notes] usage insert threw (non-fatal):",
      (e as Error)?.message,
    );
  }

  // (9) Remaining (null = unlimited admin).
  let remaining: number | null = null;
  if (!isAdmin) {
    const { count } = await supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    remaining = Math.max(0, limit - (count ?? 0));
  }

  return NextResponse.json({ doc, remaining });
}
