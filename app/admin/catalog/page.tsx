import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { categoryEmoji } from "@/lib/catalog/visuals";
import { asStringArray } from "@/lib/catalog/json";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function CatalogPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page || "1") || 1);
  const theme = typeof sp.theme === "string" ? sp.theme : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const q = typeof sp.q === "string" ? sp.q : "";

  const [categories, allProducts] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { active: true, ...(q ? { title: { contains: q } } : {}) },
      include: { category: true, merchant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let filtered = allProducts;
  if (category) filtered = filtered.filter((p) => p.category?.slug === category);
  if (theme) filtered = filtered.filter((p) => asStringArray(p.themeTags).includes(theme));
  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (k: string, v: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (theme) params.set("theme", theme);
    params.set(k, v);
    return "?" + params.toString();
  };

  return (
    <div>
      <form className="card-pp mb-4 flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={q} placeholder="Search title…" className="input-pp flex-1" />
        <select name="category" defaultValue={category} className="input-pp w-auto">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <button className="btn-primary btn px-4 py-2 text-sm">Filter</button>
      </form>
      <p className="mb-3 text-sm text-foreground/60">{total} products</p>
      <div className="card-pp overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-100 text-left text-foreground/60">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Merchant</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Pack</th>
              <th className="p-3 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr key={p.id} className="border-b border-brand-50">
                <td className="p-3">{categoryEmoji(p.category?.slug ?? "other")} {p.title}</td>
                <td className="p-3 text-foreground/60">{p.merchant.name}</td>
                <td className="p-3 text-foreground/60">{p.category?.name ?? "—"}</td>
                <td className="p-3 text-right">{formatCurrency(p.price)}</td>
                <td className="p-3 text-right">{p.packQuantity ?? "—"}</td>
                <td className="p-3 text-right">{p.inStock ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="mt-4 flex gap-2">
          {Array.from({ length: totalPages }).slice(0, 10).map((_, i) => (
            <Link key={i} href={qs("page", String(i + 1))} className={"btn px-3 py-1.5 text-sm " + (i + 1 === page ? "btn-primary" : "btn-secondary")}>{i + 1}</Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
