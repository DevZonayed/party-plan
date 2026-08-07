import "server-only";
import type { CandidateProduct, PlanInput, PlanOutput } from "@/lib/types";
import { createAIClient, aiModel } from "@/lib/ai/client";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { validatePlan, maxQuantityFor } from "@/lib/ai/validation";

export interface ProviderResult {
  output: PlanOutput;
  rawContentLength: number;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  model: string;
  source: "ai";
  meta: { dropped: number; capped: number };
}

export interface RecommendationProvider {
  generate(input: PlanInput, candidates: CandidateProduct[]): Promise<ProviderResult>;
}

export const OmniRouteProvider: RecommendationProvider = {
  async generate(input, candidates) {
    return generateStream(input, candidates, () => {});
  },
};

// Streams the OmniRoute completion, invoking onToken for each delta so the UI
// can render a live "thinking" preview. Returns the validated result.
export async function generateStream(
  input: PlanInput,
  candidates: CandidateProduct[],
  onToken: (delta: string, full: string) => void
): Promise<ProviderResult> {
  const client = createAIClient();
  const started = Date.now();
  const slim = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.categorySlug,
    price: c.price,
    packQuantity: c.packQuantity,
    themeTags: c.themeTags,
  }));
  const stream = await client.chat.completions.create({
    model: aiModel(),
    temperature: 0.4,
    max_tokens: 4096,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(input, slim as unknown as CandidateProduct[]) },
    ],
  });
  let raw = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let model = aiModel();
  let finishReason: string | undefined;
  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    const delta = choice?.delta?.content;
    if (delta) {
      raw += delta;
      try {
        onToken(delta, raw);
      } catch {
        /* ignore listener errors */
      }
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (chunk.usage) {
      tokensIn = chunk.usage.prompt_tokens ?? tokensIn;
      tokensOut = chunk.usage.completion_tokens ?? tokensOut;
    }
    if (chunk.model) model = chunk.model;
  }
  if (finishReason === "length") {
    throw new Error("AI output truncated at token limit (" + raw.length + " chars)");
  }
  const validated = validatePlan(raw, candidates, { guestCount: input.guestCount });
  return {
    output: validated.output,
    rawContentLength: raw.length,
    tokensIn,
    tokensOut,
    latencyMs: Date.now() - started,
    model,
    source: "ai",
    meta: validated.meta,
  };
};

// Rules-based fallback (PRD 8.7). Used when the AI call fails, times out, or
// fails validation. Deterministic: best candidate per essential category,
// quantity-scaled by the same rules. The user always gets a plan.
export function rulesBasedPlan(
  input: PlanInput,
  candidates: CandidateProduct[]
): ProviderResult {
  const byCat = new Map<string, CandidateProduct[]>();
  for (const c of candidates) {
    const arr = byCat.get(c.categorySlug) ?? [];
    arr.push(c);
    byCat.set(c.categorySlug, arr);
  }
  const themeTags = candidates
    .flatMap((c) => c.themeTags)
    .filter((t, i, a) => a.indexOf(t) === i);
  const prefersTheme = (c: CandidateProduct) =>
    c.themeTags.some((t) => themeTags.includes(t));

  const categories: PlanOutput["categories"] = [];
  for (const [slug, arr] of byCat) {
    arr.sort((a, b) => {
      const ah = prefersTheme(a) ? 0 : 1;
      const bh = prefersTheme(b) ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return a.price - b.price;
    });
    const pick = arr[0];
    if (!pick) continue;
    const qty = maxQuantityFor(pick, input.guestCount);
    categories.push({
      slug,
      name: pick.categoryName,
      items: [
        {
          productId: pick.id,
          quantity: qty,
          reason:
            "Solid " +
            pick.categoryName.toLowerCase() +
            " choice that fits the theme and scales to " +
            input.guestCount +
            " guests.",
        },
      ],
    });
  }

  // Trim to budget: keep essentials, drop priciest non-essentials until within budget.
  const priceOf = (c: PlanOutput["categories"][number]) =>
    c.items.reduce((s, it) => {
      const cand = candidates.find((x) => x.id === it.productId);
      return s + (cand ? cand.price * it.quantity : 0);
    }, 0);
  categories.sort((a, b) => priceOf(a) - priceOf(b));
  let total = categories.reduce((s, c) => s + priceOf(c), 0);
  while (total > input.budgetTotal && categories.length > 3) {
    const removed = categories.pop()!;
    total -= priceOf(removed);
  }

  const budgetAllocation: Record<string, number> = {};
  for (const c of categories) budgetAllocation[c.slug] = Math.round(priceOf(c) * 100) / 100;

  const output: PlanOutput = {
    budgetAllocation,
    categories,
    notes:
      "Auto-generated fallback plan using our top value picks for this theme and guest count. You can swap any item.",
    shippingWarning: null,
  };

  return {
    output,
    rawContentLength: 0,
    latencyMs: 0,
    model: "rules",
    source: "ai",
    meta: { dropped: 0, capped: 0 },
  };
}
