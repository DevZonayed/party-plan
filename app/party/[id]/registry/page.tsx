import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { categoryEmoji } from "@/lib/catalog/visuals";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function RegistryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await prisma.event.findUnique({
    where: { id },
    include: { registry: { include: { product: { include: { category: true } } }, orderBy: { sortOrder: "asc" } } },
  });
  if (!event) notFound();
  if (event.userId && event.userId !== user.id && user.role !== "ADMIN") notFound();
  const available = event.registry.filter((r) => r.status === "AVAILABLE").length;
  const claimed = event.registry.filter((r) => r.status === "CLAIMED").length;
  return (
    <div className="container-pp py-10">
      <Link href={"/party/" + id} className="text-sm text-foreground/60 hover:text-brand-600">← Back to party</Link>
      <h1 className="mt-2 text-2xl font-bold">🎁 Registry</h1>
      <p className="mb-6 text-foreground/60">{available} available · {claimed} claimed</p>
      <div className="space-y-2">
        {event.registry.map((ri) => (
          <div key={ri.id} className="card-pp flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{categoryEmoji(ri.product.category?.slug ?? "other")} {ri.product.title}</p>
              <p className="text-xs text-foreground/50">{ri.category ?? "Item"} · claimed by {ri.claimedBy ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">{formatCurrency(ri.product.price)}</p>
              <span className={"rounded-full px-2 py-0.5 text-xs " + (ri.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{ri.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
