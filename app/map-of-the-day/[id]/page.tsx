import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DailyMapScreen from "@/components/daily/DailyMapScreen";
import { dayKey } from "@/lib/daily-map";
import {
  loadDailyIndexServer,
  loadDailyMapServer,
} from "@/lib/daily-map-server";

export const dynamic = "force-static";
export const dynamicParams = true;

export async function generateStaticParams() {
  const index = await loadDailyIndexServer().catch(() => null);
  return (index?.maps ?? []).map((m) => ({ id: m.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const map = await loadDailyMapServer(params.id);
  if (!map) return { title: "Map of the Day — Hodos" };
  return {
    title: `${map.title} — Map of the Day — Hodos`,
    description:
      map.blurb ||
      `${map.question} A Scripture-grounded study map anchored in ${map.anchorRef}.`,
    alternates: { canonical: `/map-of-the-day/${map.id}` },
    openGraph: {
      title: `${map.title} — Hodos`,
      description: map.blurb || map.question,
      url: `/map-of-the-day/${map.id}`,
      siteName: "Hodos",
      type: "article",
    },
  };
}

export default async function DailyMapPermalink({
  params,
}: {
  params: { id: string };
}) {
  const map = await loadDailyMapServer(params.id);
  if (!map) notFound();

  const today = dayKey();
  const index = await loadDailyIndexServer().catch(() => null);
  const recent = (index?.maps ?? [])
    .filter((m) => m.id !== map.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <DailyMapScreen map={map} recent={recent} isToday={map.date === today} />
  );
}
