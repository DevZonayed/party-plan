import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hydrateFromDB } from "@/lib/ai/recommend";
import { formatCurrency, formatDate } from "@/lib/utils";
import { categoryEmoji } from "@/lib/catalog/visuals";
import { ShareBox } from "@/components/share-box";
import type { PlanOutput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PartyPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/party/" + id);
  const event = await prisma.event.findUnique({
    where: { id },
    include: { theme: true, recSets: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!event) notFound();
  if (event.userId && event.userId !== user.id && user.role !== "ADMIN") notFound();
  const set = event.recSets[0];
  const plan = set
    ? await hydrateFromDB(set.output as unknown as PlanOutput, Number(event.budgetTotal), (set.source as "ai" | "fallback" | "cached") || "ai", set.model)
    : null;
  return (
    <div className="container-pp py-10">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-foreground/60 hover:text-brand-600">← Back to dashboard</Link>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{event.theme?.emoji} {event.theme?.name ?? "Party"}</h1>
        <p className="text-foreground/60">{event.guestCount} guests · {formatCurrency(event.budgetTotal)}{event.partyDate ? " · " + formatDate(event.partyDate) : ""} · {event.status}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {plan ? (
            <>
              <div className="card-pp p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">Plan total</span>
                  <span className={"font-bold " + (plan.withinBudget ? "text-emerald-600" : "text-red-600")}>{formatCurrency(plan.total)} / {formatCurrency(plan.budgetTotal)}</span>
                </div>
                {plan.notes ? <p className="text-sm text-foreground/70">{plan.notes}</p> : null}
              </div>
              {plan.categories.map((cat) => (
                <div key={cat.slug} className="card-pp p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-bold">{categoryEmoji(cat.slug)} {cat.name}</h2>
                    <span className="text-sm text-foreground/60">{formatCurrency(cat.subtotal)}</span>
                  </div>
                  <div className="space-y-2">
                    {cat.items.map((it) => (
                      <div key={it.productId} className="flex justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{it.product.title} × {it.quantity}</span>
                        <span className="shrink-0">{formatCurrency(it.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="card-pp p-6 text-foreground/60">No plan saved for this party.</div>
          )}
        </div>
        <div className="space-y-4">
          {event.status === "PUBLISHED" ? <ShareBox token={event.token} /> : (
            <div className="card-pp p-5 text-sm text-foreground/60">This party is a draft. Publish it from the plan results to get a shareable guest page.</div>
          )}
          <Link href={"/party/" + id + "/registry"} className="card-pp block p-4 hover:border-brand-300">
            <span className="font-semibold">🎁 Registry</span>
            <p className="text-sm text-foreground/60">View gift claims</p>
          </Link>
          <Link href={"/party/" + id + "/guests"} className="card-pp block p-4 hover:border-brand-300">
            <span className="font-semibold">👥 Guests</span>
            <p className="text-sm text-foreground/60">RSVP list</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
