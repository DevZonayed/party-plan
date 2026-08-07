import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const [themes, articles] = await Promise.all([
    prisma.theme.findMany({ select: { slug: true } }),
    prisma.article.findMany({ where: { publishedAt: { not: null } }, select: { slug: true, publishedAt: true } }),
  ]);
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base + "/", lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: base + "/plan", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: base + "/how-it-works", lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: base + "/themes", lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: base + "/ideas", lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: base + "/legal/affiliate-disclosure", lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: base + "/legal/privacy", lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: base + "/legal/terms", lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
  const themeRoutes: MetadataRoute.Sitemap = themes.map((t) => ({
    url: base + "/themes/" + t.slug,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: base + "/ideas/" + a.slug,
    lastModified: a.publishedAt ?? now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...staticRoutes, ...themeRoutes, ...articleRoutes];
}
