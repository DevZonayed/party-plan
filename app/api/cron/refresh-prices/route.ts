import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (!secret) return process.env.NODE_ENV !== "production";
  return provided === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const updated = await prisma.product.updateMany({
    where: { active: true },
    data: { priceUpdatedAt: new Date() },
  });
  return Response.json({ ok: true, touched: updated.count });
}
