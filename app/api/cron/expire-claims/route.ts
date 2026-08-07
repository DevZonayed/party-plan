import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (!secret) return process.env.NODE_ENV !== "production";
  return provided === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const expired = await prisma.registryItem.updateMany({
    where: { status: "CLAIMED", claimedAt: { lt: cutoff } },
    data: { status: "AVAILABLE", claimedBy: null, claimedAt: null },
  });
  const draftCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const archived = await prisma.event.updateMany({
    where: { status: "DRAFT", createdAt: { lt: draftCutoff } },
    data: { status: "ARCHIVED" },
  });
  return Response.json({ ok: true, expiredClaims: expired.count, archivedDrafts: archived.count });
}
