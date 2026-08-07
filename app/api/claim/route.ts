import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordClick, getClientIp } from "@/lib/affiliate";
import { getBrowserKey } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  registryItemId: z.string().min(1),
  guestName: z.string().min(1).max(80),
});

// Claim BEFORE redirect, always. Marks the registry item reserved, creates the
// tracked Click, and returns the /go/[clickId] the client should navigate to.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 422 });

  const rl = rateLimit({ key: "claim:" + (getClientIp(req.headers) || "anon"), limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return Response.json({ error: "Too many actions. Try later." }, { status: 429 });

  const { registryItemId, guestName } = parsed.data;
  const item = await prisma.registryItem.findUnique({
    where: { id: registryItemId },
    include: { product: { include: { merchant: true } }, event: true },
  });
  if (!item || !item.product) return Response.json({ error: "Item not found" }, { status: 404 });

  // Atomically claim only if still available (prevents duplicate gifts).
  const updated = await prisma.registryItem
    .updateMany({
      where: { id: registryItemId, status: "AVAILABLE" },
      data: { status: "CLAIMED", claimedBy: guestName, claimedAt: new Date() },
    })
    .catch(() => null);

  const claimed = updated && updated.count > 0;
  const fresh = await prisma.registryItem.findUnique({ where: { id: registryItemId } });

  // Create the tracked click regardless (records intent), tied to the party.
  const browserKey = await getBrowserKey();
  const click = await recordClick({
    productId: item.product.id,
    merchantId: item.product.merchantId,
    source: "REGISTRY",
    referrerType: "GUEST",
    eventId: item.eventId,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });

  // stamp the browserKey on the guest if we can find them
  if (browserKey && claimed) {
    await prisma.guest.updateMany({ where: { eventId: item.eventId, name: guestName }, data: { browserKey } }).catch(() => null);
  }

  return Response.json({
    claimed,
    status: fresh?.status ?? "AVAILABLE",
    clickId: click?.id ?? null,
    goUrl: click ? "/go/" + click.id : null,
    affiliateUrl: item.product.affiliateUrl || item.product.productUrl,
  });
}
