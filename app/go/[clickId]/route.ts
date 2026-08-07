import { prisma } from "@/lib/db";
import { buildOutboundUrl } from "@/lib/affiliate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Affiliate redirect service. A Click row is created at claim time; this route
// is the single, transparent hop to the merchant (no cookie stuffing). Target: <100ms.
export async function GET(_req: Request, props: { params: Promise<{ clickId: string }> }) {
  const { clickId } = await props.params;
  const click = await prisma.click.findUnique({
    where: { id: clickId },
    include: { product: true, merchant: true },
  });
  if (!click || !click.product || !click.merchant) {
    return new Response("Not found", { status: 404 });
  }
  const dest = buildOutboundUrl({
    productUrl: click.product.productUrl,
    affiliateUrl: click.product.affiliateUrl,
    linkTemplate: click.merchant.linkTemplate,
    clickId: click.id,
    source: click.source,
  });
  return new Response(null, {
    status: 302,
    headers: { Location: dest, "Cache-Control": "no-store" },
  });
}
