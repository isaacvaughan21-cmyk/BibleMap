import { NextResponse } from "next/server";
import { BOOKS } from "@/lib/bible-books";
import { EsvRateLimitError, fetchEsvChapter } from "@/lib/esv";

/**
 * ESV chapter relay — `/api/esv?book=John&chapter=3` → `{ verses: string[] }`.
 *
 * The Crossway API key lives server-side only (read inside lib/esv.ts). The
 * client never sees it; it asks this route for one chapter at a time. See
 * lib/esv.ts for how each of Crossway's API terms is enforced.
 */

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("book") ?? "";
  const chapter = Number(searchParams.get("chapter"));

  const book = BOOKS.find((b) => b.code === code);
  if (
    !book ||
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    chapter > book.chapters
  ) {
    return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
  }

  try {
    const verses = await fetchEsvChapter(code, chapter);
    return NextResponse.json(
      { verses },
      {
        headers: {
          // Unlike NLT, no shared/CDN caching: Crossway caps cached ESV text at
          // 500 verses, and an edge cache is an unbounded store we can't count.
          // Caching stays in the bounded in-process cache (lib/esv.ts) plus the
          // reader's own session.
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream error";
    const status =
      err instanceof EsvRateLimitError
        ? 429
        : message.includes("not configured")
          ? 503
          : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
