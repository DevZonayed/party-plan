import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { asStringArray } from "@/lib/catalog/json";
import { categoryEmoji } from "@/lib/catalog/visuals";
import { ProductTile } from "@/components/product-tile";
import { formatCurrency } from "@/lib/utils";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const t = await prisma.theme.findUnique({ where: { slug } });
  if (!t) return { title: "Theme not found" };
  return {
    title: t.name + " party ideas & supplies",
    description: t.blurb ?? "Plan a " + t.name + " birthday with budget-balanced, matching party supplies.",
    openGraph: { title: t.name + " party ideas", description: t.blurb ?? undefined },
  };
}

export default async function ThemePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const theme = await prisma.theme.findUnique({ where: { slug } });
  if (!theme) notFound();
  const themeTags = asStringArray(theme.tags);
  const products = await prisma.product.findMany({
    where: { active: true, inStock: true },
    include: { category: true, merchant: { select: { name: true } } },
    take: 24,
  });
  const matching = products.filter((p) => asStringArray(p.themeTags).some((t) => themeTags.includes(t)));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: theme.name + " party supplies",
    description: theme.blurb ?? undefined,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: matching.slice(0, 10).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.title,
      })),
    },
  };
  return (
    <div className="container-pp py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-6xl" aria-hidden>{theme.emoji ?? "🎉"}</div>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{theme.name} party</h1>
          <p className="mt-2 max-w-2xl text-foreground/70">{theme.blurb}</p>
        </div>
        <Link href="/plan" className="btn-primary btn px-5 py-3">Plan a {theme.name} party ✨</Link>
      </div>
      <h2 className="mb-4 text-xl font-bold">Matching supplies</h2>
      {matching.length === 0 ? (
        <p className="text-foreground/60">Supplies coming soon for this theme.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {matching.map((p) => (
            <div key={p.id} className="card-pp overflow-hidden">
              <ProductTile seed={p.title} emoji={categoryEmoji(p.category?.slug ?? "other")} className="h-32 w-full" />
              <div className="p-3">
                <p className="truncate text-sm font-medium">{p.title}</p>
                <p className="text-xs text-foreground/50">{p.merchant.name}</p>
                <p className="mt-1 font-bold">{formatCurrency(p.price)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
