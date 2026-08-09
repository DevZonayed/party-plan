import "server-only";
import { prisma } from "@/lib/db";
import type { CandidateProduct } from "@/lib/types";
import { asStringArray } from "@/lib/catalog/json";

export interface RetrieveOptions {
  themeTags: string[];
  childAge?: number;
  guestCount: number;
  budgetTotal: number;
  perCategory?: number; // max candidates per category
}

// RETRIEVE step of the recommendation pipeline. Pulls active, in-stock
// products whose themeTags overlap the requested theme, balanced across
// categories, within a generous price band. Tag overlap + age filtering is
// done in memory because SQLite stores tags as JSON (a Postgres migration
// would push this into a native array-overlap query). Catalog is small, so
// in-memory filtering is effectively instant.
export async function retrieveCandidates(opts: RetrieveOptions): Promise<{
  candidates: CandidateProduct[];
  categorySlugs: string[];
}> {
  const perCategory = opts.perCategory ?? 8;
  const themeTags = opts.themeTags.map((t) => t.toLowerCase());

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, inStock: true },
      include: { category: true, merchant: { select: { name: true } } },
      orderBy: { price: "asc" },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  // Generous band: allow up to ~45% of total budget per single SKU so the AI
  // can consider anchor items (kits) as well as cheap fillers.
  const bandHi = Math.max(opts.budgetTotal * 0.45, 40);

  const byCategory = new Map<string, CandidateProduct[]>();
  for (const p of products) {
    const price = Number(p.price);
    if (price > bandHi) continue;
 if (opts.childAge != null && p.ageMin != null && p.ageMax != null) {
      if (opts.childAge < p.ageMin || opts.childAge > p.ageMax) continue;
    }
    const tags = asStringArray(p.themeTags);
    const hit = themeTags.some((t) => tags.includes(t));
    // Always include generic/neutral items as filler candidates. This keeps
    // custom themes plannable even when the catalog has no exact licensed set.
    const neutral = tags.length === 0;
    const generic = tags.includes("generic");
    if (!hit && !neutral && !generic) continue;

    const catSlug = p.category?.slug ?? "other";
    const arr = byCategory.get(catSlug) ?? [];
    arr.push({
      id: p.id,
      title: p.title,
      categorySlug: catSlug,
      categoryName: p.category?.name ?? "Other",
      price,
      packQuantity: p.packQuantity ?? 1,
      themeTags: tags,
      colorTags: asStringArray(p.colorTags),
    });
    byCategory.set(catSlug, arr);
  }

  // Rank: theme-matched first, then cheapest-per-unit, then take top N.
 const out: CandidateProduct[] = [];
  const usedSlugs: string[] = [];
  for (const cat of categories) {
    const arr = byCategory.get(cat.slug);
    if (!arr || arr.length === 0) continue;
    arr.sort((a, b) => {
      const aHit = a.themeTags.some((t) => themeTags.includes(t)) ? 0 : 1;
      const bHit = b.themeTags.some((t) => themeTags.includes(t)) ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
      const aUnit = a.price / Math.max(a.packQuantity, 1);
      const bUnit = b.price / Math.max(b.packQuantity, 1);
      return aUnit - bUnit;
    });
    const picked = arr.slice(0, perCategory);
    out.push(...picked);
    usedSlugs.push(cat.slug);
  }

  return { candidates: out, categorySlugs: usedSlugs };
}

export async function findSwappable(opts: {
  productId: string;
  themeTags: string[];
}) {
  const current = await prisma.product.findUnique({
    where: { id: opts.productId },
    include: { category: true },
  });
  if (!current || !current.categoryId) return null;
  const tags = opts.themeTags.map((t) => t.toLowerCase());
  const siblings = await prisma.product.findMany({
    where: {
      active: true,
      inStock: true,
      categoryId: current.categoryId,
      id: { not: current.id },
    },
    include: { merchant: { select: { name: true } } },
    orderBy: { price: "asc" },
    take: 6,
  });
  return siblings
    .filter((p) => {
      const pt = asStringArray(p.themeTags);
      return pt.length === 0 || pt.some((t) => tags.includes(t));
    })
    .slice(0, 4);
}
