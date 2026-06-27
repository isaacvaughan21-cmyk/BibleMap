import type { MetadataRoute } from "next";
import { posts } from "@/lib/blog";
import { loadDailyIndexServer } from "@/lib/daily-map-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hodos.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dailyIndex = await loadDailyIndexServer().catch(() => null);
  const dailyMaps = (dailyIndex?.maps ?? []).map((m) => ({
    url: `${SITE_URL}/map-of-the-day/${m.id}`,
    lastModified: new Date(`${m.date}T00:00:00Z`),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/map-of-the-day`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...dailyMaps,
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.datePublished),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
