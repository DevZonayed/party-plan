import "server-only";
import { z } from "zod";
import type { CandidateProduct, PlanOutput } from "@/lib/types";

export const PlanItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  reason: z.string().max(160),
});

export const PlanCategorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1).max(60),
  items: z.array(PlanItemSchema).max(8),
});

export const PlanOutputSchema = z.object({
  budgetAllocation: z.record(z.string(), z.number()),
  categories: z.array(PlanCategorySchema).min(1).max(10),
  notes: z.string().max(400),
  shippingWarning: z.string().max(200).nullable(),
});

// Strip ```json fences and leading/trailing noise so JSON.parse is reliable.
export function stripCodeFences(raw: string): string {
  let s = raw.trim();
  // Remove a leading "```json" or "```" and trailing "```".
  const fence = s.indexOf("```");
  if (fence === 0) {
    s = s.replace(/^```[a-zA-Z0-9]*\n?/, "");
    s = s.replace(/```\s*$/m, "");
  }
  // Slice from first { to last } to tolerate preamble/epilogue text.
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s.trim();
}

export interface ValidationMeta {
  dropped: number; // items removed (hallucinated productId)
  capped: number; // quantities capped by rules
}

/**
 * VALIDATE step. This is what makes hallucination structurally impossible:
 * every returned productId must exist in the candidate set, or it is dropped.
 * Quantities are sanity-checked against packQuantity. We never trust the
 * model's IDs, prices, or arithmetic.
 */
export function validatePlan(
  raw: string,
  candidates: CandidateProduct[],
  ctx: { guestCount: number }
): { output: PlanOutput; meta: ValidationMeta } {
  const candidateIds = new Set(candidates.map((c) => c.id));
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const json = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error("AI output was not valid JSON: " + (e as Error).message);
  }

  const result = PlanOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      "AI output failed schema validation: " + JSON.stringify(result.error.issues.slice(0, 3))
    );
  }

  let dropped = 0;
  let capped = 0;
  const cleanCategories = result.data.categories
    .map((cat) => {
      const items = cat.items
        .filter((item) => {
          if (!candidateIds.has(item.productId)) {
            dropped += 1;
            return false;
          }
          return true;
        })
        .map((item) => {
          const cand = byId.get(item.productId)!;
          const maxQ = maxQuantityFor(cand, ctx.guestCount);
          let q = item.quantity;
          if (q > maxQ) {
            capped += 1;
            q = maxQ;
          }
          return { ...item, quantity: Math.max(1, q) };
        });
      return { ...cat, items };
    })
    .filter((cat) => cat.items.length > 0);

  if (cleanCategories.length === 0) {
    throw new Error("AI output contained no valid candidates after validation");
  }

  const output: PlanOutput = {
    budgetAllocation: result.data.budgetAllocation,
    categories: cleanCategories,
    notes: result.data.notes.slice(0, 400),
    shippingWarning: result.data.shippingWarning,
  };

  return { output, meta: { dropped, capped } };
}

// Server-side quantity rule mirror (also encoded in the prompt).
// - perGuest categories (tableware, cups, napkins, favors): ceil(guests*1.2/pack)
// - non-scaling (banners, backdrops, pinatas): 1
// - hard cap of 6 units per SKU to catch runaway quantities.
// Categories whose quantity scales with headcount (eating supplies, favors).
const PER_GUEST = new Set([
  "tableware",
  "plates",
  "cups",
  "napkins",
  "cutlery",
  "favors",
  "goody-bags",
]);

export function maxQuantityFor(cand: CandidateProduct, guestCount: number) {
  const slug = cand.categorySlug.toLowerCase();
  if (slug === "favors") {
    return clampQty(Math.ceil(guestCount / Math.max(cand.packQuantity, 1)));
  }
  if (PER_GUEST.has(slug)) {
    const need = Math.ceil((guestCount * 1.2) / Math.max(cand.packQuantity, 1));
    return clampQty(need);
  }
  // Non-scaling (banners, backdrops, balloons, tablecovers, cake): allow up
  // to 3 small multiples but prevent runaway quantities (PRD: never >3 unjustified).
  return 3;
}

function clampQty(n: number) {
  return Math.max(1, Math.min(6, n));
}

// Recompute totals server-side from validated quantities + candidate prices.
export function computeTotals(
  output: PlanOutput,
  byId: Map<string, CandidateProduct>
): Record<string, number> {
  const subtotals: Record<string, number> = {};
  for (const cat of output.categories) {
    let sum = 0;
    for (const item of cat.items) {
      const cand = byId.get(item.productId);
      if (cand) sum += cand.price * item.quantity;
    }
    subtotals[cat.slug] = Math.round(sum * 100) / 100;
  }
  return subtotals;
}
