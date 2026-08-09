import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai/client";
import { OmniRouteProvider, rulesBasedPlan, generateStream } from "@/lib/ai/provider";
import { retrieveCandidates } from "@/lib/catalog/retrieve";
import { computeTotals } from "@/lib/ai/validation";
import { asStringArray } from "@/lib/catalog/json";
import { unitLabel } from "@/lib/catalog/pack-quantity";
import type {
  CandidateProduct,
  HydratedItem,
  HydratedPlan,
  PlanInput,
  PlanOutput,
  RecSource,
} from "@/lib/types";

// In-memory plan cache keyed by inputHash. Identical input => cached plan,
// zero API cost. Single-instance deployment; swap for Redis in multi-instance.
const planCache = new Map<string, CachedPlan>();
const CACHE_CAP = 200;
interface CachedPlan {
  output: PlanOutput;
  source: RecSource;
  model?: string | null;
  candidateIds: string[];
  at: number;
}

export function hashInput(input: PlanInput, themeId: string): string {
  const norm = [
    input.siteSlug,
    themeId,
    input.themeSlug,
    input.childAge ?? "",
    input.guestCount,
    Math.round(input.budgetTotal),
    input.locationType ?? "",
  ].join("|");
  return createHash("sha256").update(norm).digest("hex");
}

export interface GenerateResult {
  plan: HydratedPlan;
  output: PlanOutput;
  source: RecSource;
  model?: string | null;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  dropped: number;
  candidateIds: string[];
  inputHash: string;
}

export async function generatePlan(input: PlanInput): Promise<GenerateResult> {
  const theme = await prisma.theme.findUnique({ where: { slug: input.themeSlug } });
  const themeTags = theme
    ? asStringArray(theme.tags)
    : [...new Set([input.themeSlug.toLowerCase(), ...(input.themeTags ?? [])])];
  const themeId = theme?.id ?? input.themeSlug;
  const inputHash = hashInput(input, themeId);

  // 1. Cache check.
  const cached = planCache.get(inputHash);

  // 2. Retrieve candidates.
  const { candidates } = await retrieveCandidates({
    themeTags,
    childAge: input.childAge,
    guestCount: input.guestCount,
    budgetTotal: input.budgetTotal,
  });

  if (candidates.length === 0) {
    throw new Error("No products match this theme yet. Try another theme.");
  }

  const byId = new Map(candidates.map((c) => [c.id, c]));

  // 3. If cached and candidate set still valid, reuse (zero API cost).
  if (cached && cached.candidateIds.every((id) => byId.has(id))) {
    const plan = hydratePlan(cached.output, input.budgetTotal, byId, cached.source, cached.model);
    return {
      plan,
      output: cached.output,
      source: "cached",
      model: cached.model,
      latencyMs: 0,
      dropped: 0,
      candidateIds: candidates.map((c) => c.id),
      inputHash,
    };
  }

  // 4. AI generate + validate, with rules-based fallback.
  let source: RecSource = "ai";
  let result;
  try {
    if (!isAIConfigured()) throw new Error("AI not configured");
    result = await OmniRouteProvider.generate(input, candidates);
    source = "ai";
  } catch (e) {
    console.warn("[recommend] AI failed, using fallback:", (e as Error).message);
    result = rulesBasedPlan(input, candidates);
    source = "fallback";
  }

  // 5. Compute server-authoritative totals.
  const subtotals = computeTotals(result.output, byId);
  const merged: PlanOutput = {
    ...result.output,
    budgetAllocation: { ...result.output.budgetAllocation, ...subtotals },
  };

  // 6. Cache.
  planCache.set(inputHash, {
    output: merged,
    source,
    model: result.model,
    candidateIds: candidates.map((c) => c.id),
    at: Date.now(),
  });
  if (planCache.size > CACHE_CAP) {
    const oldest = planCache.keys().next().value;
    if (oldest) planCache.delete(oldest);
  }

  const plan = hydratePlan(merged, input.budgetTotal, byId, source, result.model);

  return {
    plan,
    output: merged,
    source,
    model: result.model,
    latencyMs: result.latencyMs,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    dropped: result.meta.dropped,
    candidateIds: candidates.map((c) => c.id),
    inputHash,
  };
}

export function hydratePlan(
  output: PlanOutput,
  budgetTotal: number,
  byId: Map<string, CandidateProduct>,
  source: RecSource,
  model?: string | null
): HydratedPlan {
  const categories = output.categories.map((cat) => {
    const items: HydratedItem[] = [];
    let subtotal = 0;
    for (const item of cat.items) {
      const cand = byId.get(item.productId);
      if (!cand) continue;
      const line = cand.price * item.quantity;
      subtotal += line;
      items.push({
        ...item,
        product: {
          id: cand.id,
          title: cand.title,
          imageUrl: "",
          price: cand.price,
          packQuantity: cand.packQuantity || null,
          productUrl: "",
          affiliateUrl: null,
          merchantName: "",
        },
        lineTotal: Math.round(line * 100) / 100,
        unitLabel: unitLabel(cand.packQuantity || null, item.quantity),
      });
    }
    return {
      slug: cat.slug,
      name: cat.name,
      items,
      subtotal: Math.round(subtotal * 100) / 100,
    };
  });

  const total = Math.round(categories.reduce((s, c) => s + c.subtotal, 0) * 100) / 100;
  return {
    categories,
    total,
    budgetTotal,
    withinBudget: total <= budgetTotal + 0.5,
    notes: output.notes,
    shippingWarning: output.shippingWarning,
    source,
    model,
  };
}

// Hydrate from a stored RecommendationSet using full DB product records.
export async function hydrateFromDB(output: PlanOutput, budgetTotal: number, source: RecSource, model?: string | null): Promise<HydratedPlan> {
  const ids = output.categories.flatMap((c) => c.items.map((i) => i.productId));
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: {
      category: true,
      merchant: { select: { name: true, linkTemplate: true } },
    },
  });
  const pMap = new Map(products.map((p) => [p.id, p]));
  const byId = new Map<string, CandidateProduct>();
  for (const p of products) {
    byId.set(p.id, {
      id: p.id,
      title: p.title,
      categorySlug: p.category?.slug ?? "other",
      categoryName: p.category?.name ?? "Other",
      price: Number(p.price),
      packQuantity: p.packQuantity ?? 1,
      themeTags: asStringArray(p.themeTags),
      colorTags: [],
    });
  }
  const base = hydratePlan(output, budgetTotal, byId, source, model);
  // Attach real product metadata.
  for (const cat of base.categories) {
    for (const item of cat.items) {
      const p = pMap.get(item.product.id);
      if (p) {
        item.product.imageUrl = p.imageUrl;
        item.product.productUrl = p.productUrl;
        item.product.affiliateUrl = p.affiliateUrl;
        item.product.merchantName = p.merchant.name;
      }
    }
  }
  return base;
}

// Streaming variant: retrieves candidates, streams the AI completion via
// onToken (for live UI), validates, falls back to rules on failure.
export async function generatePlanStreaming(
  input: PlanInput,
  onToken: (delta: string, full: string) => void
): Promise<GenerateResult> {
  const theme = await prisma.theme.findUnique({ where: { slug: input.themeSlug } });
  const themeTags = theme
    ? asStringArray(theme.tags)
    : [...new Set([input.themeSlug.toLowerCase(), ...(input.themeTags ?? [])])];
  const themeId = theme?.id ?? input.themeSlug;
  const inputHash = hashInput(input, themeId);

  const cached = planCache.get(inputHash);
  const { candidates } = await retrieveCandidates({
    themeTags,
    childAge: input.childAge,
    guestCount: input.guestCount,
    budgetTotal: input.budgetTotal,
  });
  if (candidates.length === 0) {
    throw new Error("No products match this theme yet. Try another theme.");
  }
  const byId = new Map(candidates.map((c) => [c.id, c]));

  if (cached && cached.candidateIds.every((id) => byId.has(id))) {
    const plan = hydratePlan(cached.output, input.budgetTotal, byId, cached.source, cached.model);
    return {
      plan,
      output: cached.output,
      source: "cached",
      model: cached.model,
      latencyMs: 0,
      dropped: 0,
      candidateIds: candidates.map((c) => c.id),
      inputHash,
    };
  }

  let source: RecSource = "ai";
  let result;
  try {
    if (!isAIConfigured()) throw new Error("AI not configured");
    result = await generateStream(input, candidates, onToken);
    source = "ai";
  } catch (e) {
    console.warn("[recommend] AI failed, using fallback:", (e as Error).message);
    result = rulesBasedPlan(input, candidates);
    source = "fallback";
  }

  const subtotals = computeTotals(result.output, byId);
  const merged: PlanOutput = {
    ...result.output,
    budgetAllocation: { ...result.output.budgetAllocation, ...subtotals },
  };
  planCache.set(inputHash, {
    output: merged,
    source,
    model: result.model,
    candidateIds: candidates.map((c) => c.id),
    at: Date.now(),
  });
  if (planCache.size > CACHE_CAP) {
    const oldest = planCache.keys().next().value;
    if (oldest) planCache.delete(oldest);
  }
  const plan = hydratePlan(merged, input.budgetTotal, byId, source, result.model);
  return {
    plan,
    output: merged,
    source,
    model: result.model,
    latencyMs: result.latencyMs,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    dropped: result.meta.dropped,
    candidateIds: candidates.map((c) => c.id),
    inputHash,
  };
}
