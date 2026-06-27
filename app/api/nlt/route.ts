import { NextResponse } from "next/server";
import { BOOKS } from "@/lib/bible-books";
import { fetchNltChapter } from "@/lib/nlt";

/**
 * NLT chapter relay — `/api/nlt?book=John&chapter=3` → `{ verses: string[] }`.
 *
 * The licensed Tyndale API key lives server-side only (read inside
 * lib/nlt.ts). The client never sees it; it asks this route for one chapter at
 * a time. See lib/nlt.ts for the copyright rationale.
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
    const verses = await fetchNltChapter(code, chapter);
    return NextResponse.json(
      { verses },
      {
        headers: {
          // Ephemeral CDN/edge caching only — relay, not a stored dataset.
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream error";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
