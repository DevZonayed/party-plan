import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { asStringArray } from "@/lib/catalog/json";
import type { PlanOutput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Turn an anonymous draft into a published event with a shoppable registry.
export async function POST(req: NextRequest) {
  const { draftId, hostName, message } = (await req.json().catch(() => ({}))) as {
    draftId?: string;
    hostName?: string;
    message?: string;
  };
  if (!draftId) return Response.json({ error: "draftId required" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: draftId },
    include: { recSets: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!event) return Response.json({ error: "Draft not found" }, { status: 404 });

  const user = await getCurrentUser();

  const output = event.recSets[0]?.output as unknown as PlanOutput | undefined;
  if (!output) return Response.json({ error: "Plan missing" }, { status: 422 });

  // Build registry items from the validated plan output.
  let sortOrder = 0;
  const items: { productId: string; quantity: number; category: string; aiReason: string | null; sortOrder: number }[] = [];
  const validProductIds = new Set(
    (await prisma.product.findMany({ where: { id: { in: output.categories.flatMap((c) => c.items.map((i) => i.productId)) } }, select: { id: true } })).map((p) => p.id)
  );
  for (const cat of output.categories) {
    for (const item of cat.items) {
      if (!validProductIds.has(item.productId)) continue;
      items.push({
        productId: item.productId,
        quantity: item.quantity,
        category: cat.name,
        aiReason: item.reason,
        sortOrder: sortOrder++,
      });
    }
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: {
      status: "PUBLISHED",
      userId: user?.id ?? event.userId,
      hostName: hostName || event.hostName || user?.name || null,
      message: message ?? event.message,
    },
  });

  await prisma.$transaction(
    items.map((it) =>
      prisma.registryItem.create({
        data: {
          eventId: event.id,
          productId: it.productId,
          quantity: it.quantity,
          category: it.category,
          aiReason: it.aiReason,
          sortOrder: it.sortOrder,
        },
      })
    )
  );

  return Response.json({
    eventId: updated.id,
    token: updated.token,
    registryUrl: "/e/" + updated.token,
    dashboardUrl: user ? "/party/" + updated.id : null,
  });
}
