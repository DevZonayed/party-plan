import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLegalDoc } from "@/lib/legal-content";
import { renderMarkdown } from "@/lib/markdown";

export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const doc = getLegalDoc(slug);
  if (!doc) return { title: "Not found" };
  return { title: doc.title };
}

export default async function LegalDocPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();
  return (
    <div className="container-pp py-10">
      <article className="mx-auto max-w-2xl">
        <Link href="/legal" className="text-sm text-foreground/60 hover:text-brand-600">← Legal</Link>
        <h1 className="mt-3 text-3xl font-bold">{doc.title}</h1>
        <div className="prose-pp mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.body) }} />
      </article>
    </div>
  );
}
