import "server-only";
import { prisma } from "@/lib/db";
import type { ClickSource, ReferrerType } from "@/lib/types";
import { env } from "@/lib/env";

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|pingdom|preview|lighthouse|headless/i;

export function isBot(userAgent: string | null) {
  return !!userAgent && BOT_RE.test(userAgent);
}

// Construct the outbound (affiliate) URL. If a tracked affiliateUrl exists,
// wrap through Impact linkTemplate with our click id as subId1. Otherwise
// (pending approval) return the clean merchant URL. One transparent hop only.
export function buildOutboundUrl(opts: {
  productUrl: string;
  affiliateUrl: string | null;
  linkTemplate?: string | null;
  clickId?: string;
  source?: string;
}) {
  const { productUrl, affiliateUrl, linkTemplate, clickId, source } = opts;
  if (affiliateUrl && linkTemplate) {
    try {
      const dest = encodeURIComponent(affiliateUrl);
      return linkTemplate
        .replace("{subId1}", clickId ?? "")
        .replace("{subId2}", source ?? "")
        .replace("{u}", dest)
        .replace("{destination}", dest);
    } catch {
      return affiliateUrl;
    }
  }
  return affiliateUrl ?? productUrl;
}

// Record a click fire-and-forget. Never throws. click.id => Impact SubId1.
export async function recordClick(opts: {
  productId: string;
  merchantId: string;
  source: ClickSource;
  referrerType?: ReferrerType;
  eventId?: string;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    const ipHash = opts.ip ? await hashIp(opts.ip) : null;
    const ua = (opts.userAgent ?? "").slice(0, 500);
    return await prisma.click.create({
      data: {
        productId: opts.productId,
        merchantId: opts.merchantId,
        source: opts.source,
        referrerType: opts.referrerType ?? "DIRECT",
        eventId: opts.eventId,
        userId: opts.userId ?? undefined,
        ipHash,
        userAgent: ua,
        isBot: isBot(opts.userAgent ?? null),
      },
      select: { id: true },
    });
  } catch (e) {
    console.error("[affiliate] click record failed", e);
    return null;
  }
}

async function hashIp(ip: string) {
  try {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(ip + env.AUTH_SECRET).digest("hex").slice(0, 24);
  } catch {
    return null;
  }
}

export function getClientIp(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null
  );
}
