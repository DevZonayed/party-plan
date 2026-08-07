import { prisma } from "@/lib/db";
import { ingestShopify } from "@/lib/catalog/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (!secret) return process.env.NODE_ENV !== "production";
  return provided === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const merchants = await prisma.merchant.findMany({ where: { active: true, shopDomain: { not: null } } });
  const results = [];
  for (const m of merchants) {
    results.push(await ingestShopify(m.id, { maxPages: 5 }));
  }
  return Response.json({ ok: true, results });
}
