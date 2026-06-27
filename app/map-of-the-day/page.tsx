import type { Metadata } from "next";
import Link from "next/link";
import DailyMapScreen from "@/components/daily/DailyMapScreen";
import { dayKey } from "@/lib/daily-map";
import {
  loadDailyIndexServer,
  loadTodaysMapServer,
} from "@/lib/daily-map-server";

// Date-dependent — re-pick today's map on each request rather than caching the
// build-time day.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Map of the Day — Hodos",
  description:
    "A new, Scripture-grounded mind map every day: a verse, the question it raises, and the cross-references that piece it together. Read it free, or save it to your own canvas.",
  alternates: { canonical: "/map-of-the-day" },
  openGraph: {
    title: "Map of the Day — Hodos",
    description:
      "A new, Scripture-grounded mind map every day — a verse, a question, and the cross-references that answer it.",
    url: "/map-of-the-day",
    siteName: "Hodos",
    type: "website",
  },
};

export default async function MapOfTheDayPage() {
  const today = dayKey();
  const map = await loadTodaysMapServer(today);

  if (!map) {
    return (
      <div className="mx-auto max-w-2xl px-gutter py-rhythm text-center md:px-0">
        <p className="mb-3 font-sans text-2xs tracking-eyebrow text-gold">
          MAP OF THE DAY
        </p>
        <h1 className="mb-4 font-serif text-xl text-ink">
          Today&rsquo;s map is on its way.
        </h1>
        <p className="font-sans text-base text-ink-muted">
          Check back shortly — a fresh study map is published every day.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block font-sans text-xs tracking-eyebrow text-gold transition-colors hover:text-ink"
        >
          START YOUR OWN MAP →
        </Link>
      </div>
    );
  }

  const index = await loadDailyIndexServer().catch(() => null);
  const recent = (index?.maps ?? [])
    .filter((m) => m.id !== map.id && m.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return <DailyMapScreen map={map} recent={recent} isToday />;
}
