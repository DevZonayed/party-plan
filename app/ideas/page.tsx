import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;
export const metadata = {
  title: "Party ideas & guides",
  description: "Birthday party ideas, budget guides, and theme inspiration.",
};

export default async function IdeasPage() {
  const articles = await prisma.article.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });
  return (
    <div className="container-pp py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">Party ideas</h1>
      <p className="mt-2 text-foreground/60">Guides and inspiration to plan the perfect birthday.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {articles.map((a) => (
          <Link key={a.slug} href={"/ideas/" + a.slug} className="card-pp block overflow-hidden hover:border-brand-300">
            <div className="h-28 w-full" style={{ background: "linear-gradient(135deg, " + (a.heroColor ?? "#7c3aed") + ", #ec4899)" }} />
            <div className="p-5">
              <h2 className="font-bold">{a.title}</h2>
              {a.excerpt ? <p className="mt-1 text-sm text-foreground/60">{a.excerpt}</p> : null}
              <p className="mt-3 text-xs text-foreground/50">{a.readMinutes} min read · {formatDate(a.publishedAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
