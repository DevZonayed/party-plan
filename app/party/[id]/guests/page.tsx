import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function GuestsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await prisma.event.findUnique({
    where: { id },
    include: { guests: { orderBy: { createdAt: "desc" } } },
  });
  if (!event) notFound();
  if (event.userId && event.userId !== user.id && user.role !== "ADMIN") notFound();
  return (
    <div className="container-pp py-10">
      <Link href={"/party/" + id} className="text-sm text-foreground/60 hover:text-brand-600">← Back to party</Link>
      <h1 className="mt-2 text-2xl font-bold">👥 Guests</h1>
      <p className="mb-6 text-foreground/60">{event.guests.length} RSVPs</p>
      {event.guests.length === 0 ? (
        <div className="card-pp p-8 text-center text-foreground/60">No RSVPs yet. Share your guest page!</div>
      ) : (
        <div className="space-y-2">
          {event.guests.map((g) => (
            <div key={g.id} className="card-pp flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{g.name} {g.attending ? "" : "(not attending)"}</p>
                <p className="text-xs text-foreground/50">Party of {g.partySize} · {formatDate(g.createdAt)}</p>
                {g.note ? <p className="mt-1 text-sm text-foreground/70">“{g.note}”</p> : null}
              </div>
              <span className={"rounded-full px-2 py-0.5 text-xs " + (g.attending ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700")}>{g.attending ? "Attending" : "Regrets"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
