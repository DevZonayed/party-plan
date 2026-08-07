import Link from "next/link";
import { prisma } from "@/lib/db";
import { ThemeTile } from "@/components/product-tile";

export const revalidate = 3600;
export const metadata = {
  title: "Party themes",
  description: "Browse curated kids' birthday party themes with matching, budget-balanced supplies.",
};

export default async function ThemesPage() {
  const themes = await prisma.theme.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="container-pp py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">Party themes</h1>
      <p className="mt-2 text-foreground/60">Curated, matching supplies per theme — pick one and let AI build the rest.</p>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {themes.map((t) => (
          <Link key={t.slug} href={"/themes/" + t.slug} className="group">
            <ThemeTile seed={t.slug} emoji={t.emoji ?? "🎉"} heroColor={t.heroColor ?? "#7c3aed"} />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold group-hover:text-brand-600">{t.name}</span>
              <span className="text-brand-600 opacity-0 transition group-hover:opacity-100">→</span>
            </div>
            <p className="text-sm text-foreground/55">{t.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
