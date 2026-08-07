import "server-only";
import { prisma } from "@/lib/db";
import { parsePackQuantity } from "@/lib/catalog/pack-quantity";

// Shopify stores expose a public products.json endpoint (250/page). This is the
// prototype/fallback catalog path per the PRD: real merchant data before any
// affiliate feed is approved. Respect robots.txt, rate-limit, off-peak, read-only.
// Switch to the Impact feed as source of truth once approved.
type ShopifyProduct = {
  id: number;
  title: string;
  body_html?: string;
  handle: string;
  product_type?: string;
  vendor?: string;
  images?: { src: string }[];
  variants?: { id: number; price?: string; compare_at_price?: string }[];
  tags?: string;
};
type ShopifyResponse = { products?: ShopifyProduct[] };

export async function ingestShopify(merchantId: string, opts?: { maxPages?: number }) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant || !merchant.shopDomain) {
    return { merchantId, ingested: 0, errors: ["No shopDomain configured"] };
  }
  const maxPages = opts?.maxPages ?? 5;
  let ingested = 0;
  const errors: string[] = [];
  const seenExternalIds = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const url = "https://" + merchant.shopDomain + "/products.json?limit=250&page=" + page;
    let data: ShopifyResponse;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PartyPlan-CatalogBot/1.0 (+contact: hello@partyplan.app)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        errors.push("page " + page + " HTTP " + res.status);
        break;
      }
      data = (await res.json()) as ShopifyResponse;
    } catch (e) {
      errors.push("page " + page + ": " + (e as Error).message);
      break;
    }
    const products = data.products ?? [];
    if (products.length === 0) break;
    for (const p of products) {
      const externalId = String(p.id);
      seenExternalIds.add(externalId);
      const variant = p.variants?.[0];
      const price = variant?.price ? Number(variant.price) : NaN;
      if (!Number.isFinite(price) || price <= 0) continue;
      const title = p.title?.trim() || "Untitled product";
      const packQuantity = parsePackQuantity(title);
      const imageUrl = p.images?.[0]?.src ?? "";
      try {
        await prisma.product.upsert({
          where: { merchantId_externalId: { merchantId, externalId } },
          update: {
            title,
            description: stripHtml(p.body_html ?? ""),
            price,
            compareAtPrice: variant?.compare_at_price ? Number(variant.compare_at_price) : null,
            imageUrl,
            packQuantity,
            inStock: true,
            active: true,
            priceUpdatedAt: new Date(),
            productUrl: "https://" + merchant.shopDomain + "/products/" + p.handle,
          },
          create: {
            merchantId,
            externalId,
            title,
            description: stripHtml(p.body_html ?? ""),
            price,
            compareAtPrice: variant?.compare_at_price ? Number(variant.compare_at_price) : null,
            imageUrl,
            imageUrls: (p.images ?? []).map((i) => i.src).slice(0, 5),
            packQuantity,
            productUrl: "https://" + merchant.shopDomain + "/products/" + p.handle,
            themeTags: parseTags(p.tags),
          },
        });
        ingested++;
      } catch (e) {
        errors.push("product " + externalId + ": " + (e as Error).message);
      }
    }
    // Rate limit: ~1 req/sec, off-peak friendly.
    await new Promise((r) => setTimeout(r, 1000));
    if (products.length < 250) break;
  }
  return { merchantId, ingested, errors, pagesSeen: seenExternalIds.size };
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
}

function parseTags(tags?: string): string[] {
  if (!tags) return [];
  return tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
}
