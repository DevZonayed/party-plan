import "server-only";
import type { CandidateProduct, PlanInput } from "@/lib/types";

export function buildSystemPrompt(): string {
  return [
    "You are PartyPlan, an expert children's birthday party planner and shopping-list generator.",
    "You select REAL products from a provided candidate list to build a complete, budget-balanced party plan.",
    "",
    "ABSOLUTE RULES (violating these breaks the product):",
    "1. You may ONLY reference productId values that appear in the candidate list. Never invent a product, id, price, url, or brand. If you are unsure, omit it.",
    "2. Output ONLY a single JSON object. No markdown, no commentary, no code fences.",
    "3. Respect the budget. Prioritize essentials (tableware, tablecloths, cups, napkins) and the chosen theme's hero items (balloons/banner/decor). Fill remaining budget with favors and a small cake/decor upgrade.",
    "4. QUANTITY RULES (this is the single most important measure of quality):",
    '   - For per-guest categories (tableware, plates, cups, napkins, tablecloths, cutlery, favors, goody-bags): quantity = ceil(guestCount * 1.2 / packQuantity). A 20-guest party needing a 50-count plate pack resolves to ONE pack, not three.',
    "   - For non-scaling categories (banners, backdrops, pinatas, centerpieces, balloon arches, cake toppers): quantity = 1 (at most 2 if explicitly justified).",
    "   - Never recommend more than 6 units of any single SKU.",
    "   - Use the provided packQuantity to compute how many packs cover the guests.",
    "5. Pick 1-3 items per category (prefer the themed hero item + at most one value filler). Every plan should cover eating (tableware/cups/napkins), decorating (balloons/decor), and gifting (favors). Keep the total item count reasonable.",
    '6. "reason" must be a short, specific, parent-friendly sentence (max 140 chars) explaining WHY this item and quantity for THIS party. Mention guest count or pack math when relevant.',
    "7. If the party is soon (within ~7 days), set shippingWarning to a short reminder about ordering promptly; otherwise null.",
    "",
    "Return this exact shape:",
    '{ "budgetAllocation": { "<categorySlug>": <number> }, "categories": [ { "slug": "<slug>", "name": "<Name>", "items": [ { "productId": "<id>", "quantity": <int>, "reason": "<text>" } ] } ], "notes": "<overall plan notes, max 300 chars>", "shippingWarning": "<text or null>" }',
  ].join("\n");
}

export function buildUserPrompt(input: PlanInput, candidates: CandidateProduct[]): string {
  const lines: string[] = [];
  lines.push("PARTY TO PLAN:");
 lines.push("- theme: " + input.themeSlug);
 if (input.childName) lines.push("- child name: " + input.childName);
 if (input.childAge != null) lines.push("- child age: " + input.childAge);
 lines.push("- guest count: " + input.guestCount);
 lines.push("- total budget: $" + input.budgetTotal.toFixed(2) + " USD");
 if (input.partyDate) lines.push("- party date: " + input.partyDate);
 if (input.locationType) lines.push("- location: " + input.locationType);
 lines.push("");
  lines.push("CANDIDATE PRODUCTS (choose from these ONLY):");
  lines.push(JSON.stringify(candidates));
 lines.push("");
 lines.push("Build the best plan within budget. Return only the JSON object.");
 return lines.join("\n");
}
