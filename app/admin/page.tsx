import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [products, themes, events, clicks, clicks7, recentEvents, conversions] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.theme.count(),
    prisma.event.count(),
    prisma.click.count(),
    prisma.click.count({ where: { createdAt: { gt: new Date(Date.now() - 7 * 86400000) } } }),
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { theme: true } }),
    prisma.conversion.findMany({ where: { status: "APPROVED" }, select: { commission: true } }),
  ]);
  const earnings = conversions.reduce((s, c) => s + Number(c.commission), 0);
  const published = events; // total

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Products" value={String(products)} />
        <Stat label="Themes" value={String(themes)} />
        <Stat label="Events" value={String(published)} />
        <Stat label="Total clicks" value={String(clicks)} />
        <Stat label="Clicks (7d)" value={String(clicks7)} />
        <Stat label="Approved earnings" value={formatCurrency(earnings)} />
      </div>
      <h2 className="mb-3 mt-8 font-bold">Recent events</h2>
      <div className="space-y-2">
        {recentEvents.map((e) => (
          <Link key={e.id} href={"/party/" + e.id} className="card-pp flex items-center justify-between p-3 text-sm hover:border-brand-300">
            <span>{e.theme?.emoji} {e.theme?.name ?? "Party"} · {e.guestCount} guests</span>
            <span className="text-foreground/50">{e.status} · {formatCurrency(e.budgetTotal)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-pp p-4">
      <div className="text-2xl font-extrabold text-brand-600">{value}</div>
      <div className="text-xs text-foreground/60">{label}</div>
    </div>
  );
}
