import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export interface SiteConfig {
  brandName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  promptTemplate?: string;
  childLabel: string; // "child" vs "baby"
  hasAge: boolean;
  defaultBudget: number;
  emoji: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  brandName: "PartyPlan",
  tagline: "Plan the perfect kids' birthday — AI does the shopping list.",
  primaryColor: "#7c3aed",
  accentColor: "#ec4899",
  childLabel: "child",
  hasAge: true,
  defaultBudget: 180,
  emoji: "🎉",
};

export function parseSiteConfig(raw: unknown): SiteConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_SITE_CONFIG;
  const c = raw as Record<string, unknown>;
  return { ...DEFAULT_SITE_CONFIG, ...(c as Partial<SiteConfig>) };
}

export async function resolveSiteByHost(host: string | null) {
  if (host) {
    const byDomain = await prisma.site.findUnique({ where: { domain: host } });
    if (byDomain) return byDomain;
  }
  const slug = env.DEFAULT_SITE;
  const bySlug = await prisma.site.findUnique({ where: { slug } });
  if (bySlug) return bySlug;
  const anyActive = await prisma.site.findFirst({ where: { active: true } });
  return anyActive ?? null;
}

export async function getActiveSite() {
  const site = await resolveSiteByHost(await currentHost());
  return site;
}

export async function getSite(slug: string) {
  return prisma.site.findUnique({ where: { slug } });
}

export async function currentHost() {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get("host");
  } catch {
    return null;
  }
}

export async function getActiveSiteConfig(): Promise<{ site: NonNullable<Awaited<ReturnType<typeof getActiveSite>>>; config: SiteConfig }> {
  const site = await getActiveSite();
  const resolved = site ?? null;
  return {
    site: resolved as NonNullable<Awaited<ReturnType<typeof getActiveSite>>>,
    config: parseSiteConfig(resolved?.config),
  };
}
