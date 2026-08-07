import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { findSwappable } from "@/lib/catalog/retrieve";
import { asStringArray } from "@/lib/catalog/json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single-item swap runs a plain DB query with the same filters — no LLM call.
export async function POST(req: NextRequest) {
  const { productId, themeSlug } = (await req.json().catch(() => ({}))) as {
    productId?: string;
    themeSlug?: string;
  };
  if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
  const theme = themeSlug ? await prisma.theme.findUnique({ where: { slug: themeSlug } }) : null;
  const themeTags = theme ? asStringArray(theme.tags) : themeSlug ? [themeSlug] : [];
  const products = await findSwappable({ productId, themeTags });
  return Response.json({
    alternatives: (products ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      price: Number(p.price),
      packQuantity: p.packQuantity,
      productUrl: p.productUrl,
      affiliateUrl: p.affiliateUrl,
      imageUrl: p.imageUrl,
      merchantName: p.merchant?.name ?? "",
      categoryId: p.categoryId,
    })),
  });
}
