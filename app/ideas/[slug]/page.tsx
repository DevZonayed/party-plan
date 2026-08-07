import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/utils";
import { FtcDisclosure } from "@/components/ftc-disclosure";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const a = await prisma.article.findFirst({ where: { slug, publishedAt: { not: null } } });
  if (!a) return { title: "Article not found" };
  return { title: a.title, description: a.excerpt ?? undefined, openGraph: { title: a.title, description: a.excerpt ?? undefined, type: "article" } };
}

export default async function ArticlePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const article = await prisma.article.findFirst({ where: { slug, publishedAt: { not: null } } });
  if (!article) notFound();
  const html = renderMarkdown(article.body);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt ?? undefined,
    datePublished: article.publishedAt,
    author: { "@type": "Organization", name: "PartyPlan" },
  };
  return (
    <div className="container-pp py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-2xl">
        <Link href="/ideas" className="text-sm text-foreground/60 hover:text-brand-600">← All ideas</Link>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{article.title}</h1>
        {article.excerpt ? <p className="mt-2 text-lg text-foreground/70">{article.excerpt}</p> : null}
        <p className="mt-2 text-sm text-foreground/50">{article.readMinutes} min read · {formatDate(article.publishedAt)}</p>
        <div className="prose-pp mt-8" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="mt-10">
          <FtcDisclosure />
        </div>
        <div className="card-pp mt-8 p-6 text-center">
          <p className="font-semibold">Want a plan built for your party?</p>
          <Link href="/plan" className="btn-primary btn mt-3 px-5 py-3">✨ Plan a party free</Link>
        </div>
      </article>
    </div>
  );
}
