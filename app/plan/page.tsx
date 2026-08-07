import { prisma } from "@/lib/db";
import { asStringArray } from "@/lib/catalog/json";
import { PlanWizard, type ThemeOption } from "@/components/plan-wizard";

export const metadata = {
  title: "Plan a Party — AI Party Planner",
  description:
    "Describe your child's birthday and our AI builds a complete, budget-balanced shopping plan from real party supplies.",
};

export default async function PlanPage() {
  const themes = await prisma.theme.findMany({
    orderBy: { name: "asc" },
    include: { site: { select: { slug: true } } },
  });
  const options: ThemeOption[] = themes.map((t) => ({
    slug: t.slug,
    name: t.name,
    emoji: t.emoji ?? "🎉",
    heroColor: t.heroColor ?? "#7c3aed",
    blurb: t.blurb ?? "",
    ageMin: t.ageMin ?? null,
    ageMax: t.ageMax ?? null,
  }));
  return <PlanWizard themes={options} />;
}
