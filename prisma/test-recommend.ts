import { generatePlan } from "../lib/ai/recommend";

async function main() {
  const res = await generatePlan({
    siteSlug: "birthday",
    themeSlug: "bluey",
    childAge: 5,
    guestCount: 20,
    budgetTotal: 180,
  });
  console.log("source:", res.source, "model:", res.model, "latency:", res.latencyMs, "ms");
  console.log("tokens:", res.tokensIn, "/", res.tokensOut, "dropped:", res.dropped);
  console.log("total: $" + res.plan.total, "budget: $" + res.plan.budgetTotal, "within:", res.plan.withinBudget);
  for (const c of res.plan.categories) {
    console.log("  [" + c.slug + "] $" + c.subtotal);
    for (const it of c.items) {
      console.log("    - " + it.product.title + " x" + it.quantity + " = $" + it.lineTotal + " (" + it.unitLabel + ")");
      console.log("      reason: " + it.reason);
    }
  }
  console.log("notes:", res.plan.notes);
  console.log("shippingWarning:", res.plan.shippingWarning);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
