export function FtcDisclosure({ variant = "inline" }: { variant?: "inline" | "compact" }) {
  if (variant === "compact") {
    return (
      <p className="text-xs text-foreground/60">
        <span className="font-semibold text-foreground/70">Affiliate disclosure:</span> Product
        links may be affiliate links. We may earn a commission on qualifying purchases at no
        extra cost to you.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong className="font-semibold">Affiliate disclosure.</strong> PartyPlan recommends
      products from partner merchants. Some links are affiliate links — we may earn a commission
      on qualifying purchases, at no additional cost to you. Prices and availability are set by
      the merchant and may change.
    </div>
  );
}
