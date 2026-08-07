import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SignoutButton } from "@/components/signout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const events = await prisma.event.findMany({
    where: { userId: user.id },
    include: { theme: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="container-pp py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Your parties</h1>
          <p className="text-foreground/60">Hi {user.name || user.email} 👋</p>
        </div>
        <div className="flex items-center gap-2">
          {user.role === "ADMIN" ? <Link href="/admin" className="btn-secondary btn px-3 py-2 text-sm">Admin</Link> : null}
          <SignoutButton />
        </div>
      </div>
      <Link href="/plan" className="card-pp mb-6 flex items-center justify-between p-5 hover:border-brand-300">
        <div>
          <p className="font-semibold">✨ Plan a new party</p>
          <p className="text-sm text-foreground/60">AI builds a budget-balanced shopping list in seconds.</p>
        </div>
        <span className="text-brand-600">→</span>
      </Link>
      {events.length === 0 ? (
        <div className="card-pp p-10 text-center text-foreground/60">
          No parties yet. <Link href="/plan" className="text-brand-600 underline">Plan your first one →</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((ev) => (
            <div key={ev.id} className="card-pp p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{ev.theme?.emoji} {ev.theme?.name ?? "Party"}</span>
                <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (ev.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700")}>{ev.status}</span>
              </div>
              <p className="text-sm text-foreground/60">{ev.guestCount} guests · {formatCurrency(ev.budgetTotal)}{ev.partyDate ? " · " + formatDate(ev.partyDate) : ""}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Link href={"/party/" + ev.id} className="btn-secondary btn px-3 py-1.5 text-xs">View plan</Link>
                {ev.status === "PUBLISHED" ? <Link href={"/e/" + ev.token} className="btn-ghost btn px-3 py-1.5 text-xs">Guest page ↗</Link> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
