import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { GuestExperience, type GuestRegistryItem } from "@/components/guest-experience";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "You're invited — PartyPlan",
    description: "RSVP and view the gift registry for this party.",
    robots: { index: false, follow: false }, // never index event pages (child data)
  };
}

export default async function GuestPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const event = await prisma.event.findUnique({
    where: { token },
    include: {
      theme: true,
      registry: {
        include: { product: { include: { merchant: true, category: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!event || event.status === "DRAFT") notFound();

  const theme = event.theme;
  const items: GuestRegistryItem[] = event.registry.map((ri) => ({
    id: ri.id,
    status: ri.status,
    claimedBy: ri.claimedBy,
    quantity: ri.quantity,
    category: ri.category,
    aiReason: ri.aiReason,
    product: {
      id: ri.product.id,
      title: ri.product.title,
      price: Number(ri.product.price),
      imageUrl: ri.product.imageUrl,
      productUrl: ri.product.productUrl,
      affiliateUrl: ri.product.affiliateUrl,
      merchantName: ri.product.merchant.name,
      categorySlug: ri.product.category?.slug ?? "other",
    },
  }));

  return (
    <div className="container-pp py-8">
      <GuestExperience
        token={event.token}
        hostName={event.hostName ?? undefined}
        message={event.message ?? undefined}
        partyDate={formatDate(event.partyDate)}
        guestCount={event.guestCount}
        themeName={theme?.name ?? "the party"}
        themeEmoji={theme?.emoji ?? "🎉"}
        themeColor={theme?.heroColor ?? "#7c3aed"}
        registry={items}
      />
    </div>
  );
}
