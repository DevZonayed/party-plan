import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const since = new Date(Date.now() - 30 * 86400000);
  const [clicks, conversions, products, themes] = await Promise.all([
    prisma.click.findMany({ where: { createdAt: { gt: since } }, include: { product: { select: { title: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.conversion.findMany({ select: { orderValue: true, commission: true, status: true } }),
    prisma.product.findMany({ select: { id: true, title: true } }),
    prisma.theme.findMany({ select: { id: true, name: true, emoji: true, events: { select: { id: true } } } }),
  ]);

  // Clicks per day (last 30)
  const byDay = new Map<string, number>();
  for (const c of clicks) {
    const d = c.createdAt.toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const dayEntries = [...byDay.entries()].sort();
  const maxDay = Math.max(1, ...dayEntries.map(([, n]) => n));

  // By source
  const bySource = new Map<string, number>();
  for (const c of clicks) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  const sourceEntries = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  const maxSource = Math.max(1, ...sourceEntries.map(([, n]) => n));

  // Top products by clicks
  const byProduct = new Map<string, number>();
  for (const c of clicks) {
    if (!c.product) continue;
    byProduct.set(c.product.title, (byProduct.get(c.product.title) ?? 0) + 1);
  }
  const topProducts = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxProd = Math.max(1, ...topProducts.map(([, n]) => n));

  const approved = conversions.filter((c) => c.status === "APPROVED");
  const pending = conversions.filter((c) => c.status === "PENDING");
  const earnings = approved.reduce((s, c) => s + Number(c.commission), 0);
  const orderValue = approved.reduce((s, c) => s + Number(c.orderValue), 0);
  const themeRows = themes.map((t) => ({ name: t.name, emoji: t.emoji ?? "🎉", count: t.events.length })).sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Clicks (30d)" value={String(clicks.length)} />
        <Card label="Conversions (approved)" value={String(approved.length)} />
        <Card label="Order value (approved)" value={formatCurrency(orderValue)} />
        <Card label="Earnings (approved)" value={formatCurrency(earnings)} />
      </div>

      <Section title="Clicks by day (last 30 days)">
        <div className="flex h-32 items-end gap-1">
          {dayEntries.length === 0 ? <Empty /> : dayEntries.map(([d, n]) => (
            <div key={d} title={d + ": " + n} className="flex-1 rounded-t bg-brand-400" style={{ height: (n / maxDay) * 100 + "%" }} />
          ))}
        </div>
      </Section>

      <Section title="Clicks by source">
        {sourceEntries.length === 0 ? <Empty /> : sourceEntries.map(([src, n]) => (
          <Bar key={src} label={src} value={n} max={maxSource} />
        ))}
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Top products by clicks">
          {topProducts.length === 0 ? <Empty /> : topProducts.map(([title, n]) => (
            <Bar key={title} label={title} value={n} max={maxProd} />
          ))}
        </Section>
        <Section title="Events by theme">
          {themeRows.length === 0 ? <Empty /> : themeRows.map((t) => (
            <Bar key={t.name} label={t.emoji + " " + t.name} value={t.count} max={Math.max(1, ...themeRows.map((x) => x.count))} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-pp p-5">
      <h2 className="mb-4 font-bold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Card({ label, value }: { label: string; value: string }) {
  return <div className="card-pp p-4"><div className="text-xl font-bold text-brand-600">{value}</div><div className="text-xs text-foreground/60">{label}</div></div>;
}
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 shrink-0 truncate text-foreground/70">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-brand-100">
        <div className="h-full rounded bg-brand-500" style={{ width: (value / max) * 100 + "%" }} />
      </div>
      <span className="w-8 shrink-0 text-right font-medium">{value}</span>
    </div>
  );
}
function Empty() {
  return <p className="text-sm text-foreground/50">No data yet.</p>;
}
