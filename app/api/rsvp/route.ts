import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getBrowserKey } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().min(8).max(40),
  name: z.string().min(1).max(80),
  attending: z.boolean().default(true),
  partySize: z.number().int().min(1).max(20).default(1),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 422 });
  const d = parsed.data;

  const rl = rateLimit({ key: "rsvp:anon", limit: 40, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return Response.json({ error: "Too many submissions." }, { status: 429 });

  const event = await prisma.event.findUnique({ where: { token: d.token } });
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  const browserKey = await getBrowserKey();
  const guest = await prisma.guest.create({
    data: {
      eventId: event.id,
      name: d.name,
      attending: d.attending,
      partySize: d.partySize,
      note: d.note || null,
      browserKey,
    },
  });
  return Response.json({ ok: true, guestId: guest.id });
}
