import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const articles = await prisma.article.findMany({ orderBy: { publishedAt: "desc" } });
  return (
    <div>
      <p className="mb-3 text-sm text-foreground/60">{articles.length} articles</p>
      <div className="space-y-2">
        {articles.map((a) => (
          <div key={a.id} className="card-pp flex items-center justify-between p-3 text-sm">
            <span className="font-medium">{a.title}</span>
            <div className="flex items-center gap-3 text-foreground/50">
              <span>{a.readMinutes} min</span>
              <span>{formatDate(a.publishedAt)}</span>
              <Link href={"/ideas/" + a.slug} className="text-brand-600">view ↗</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
