"use client";
import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { categoryEmoji } from "@/lib/catalog/visuals";
import { ProductTile } from "@/components/product-tile";
import { FtcDisclosure } from "@/components/ftc-disclosure";

export type GuestRegistryItem = {
  id: string;
  status: string;
  claimedBy: string | null;
  quantity: number;
  category: string | null;
  aiReason: string | null;
  product: {
    id: string;
    title: string;
    price: number;
    imageUrl: string;
    productUrl: string;
    affiliateUrl: string | null;
    merchantName: string;
    categorySlug: string;
  };
};

export function GuestExperience(props: {
  token: string;
  hostName?: string;
  message?: string;
  partyDate: string;
  guestCount: number;
  themeName: string;
  themeEmoji: string;
  themeColor: string;
  registry: GuestRegistryItem[];
}) {
  const [rsvpDone, setRsvpDone] = useState(false);
  const [name, setName] = useState("");
  const [attending, setAttending] = useState(true);
  const [partySize, setPartySize] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState(props.registry);

  async function submitRsvp(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, name, attending, partySize }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not submit RSVP");
      }
      setRsvpDone(true);
      setTimeout(() => {
        document.getElementById("registry")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function claim(item: GuestRegistryItem) {
    if (item.status !== "AVAILABLE") return;
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registryItemId: item.id, guestName: name || "A guest" }),
      });
      const j = await res.json();
      if (j.claimed && j.goUrl) {
        setRegistry((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: "CLAIMED", claimedBy: name || "A guest" } : it))
        );
        // Redirect through the tracked hop to the merchant.
        window.location.href = j.goUrl;
      } else {
        // Someone else claimed it first.
        setRegistry((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: j.status ?? "CLAIMED" } : it))
        );
      }
    } catch {
      // Fall back to the plain merchant link if tracking fails.
      window.location.href = item.product.affiliateUrl || item.product.productUrl;
    }
  }

  const available = registry.filter((i) => i.status === "AVAILABLE").length;

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="card-pp overflow-hidden"
        style={{ background: "linear-gradient(135deg, " + props.themeColor + "22, transparent)" }}
      >
        <div className="p-6 sm:p-8">
          <div className="mb-2 text-5xl" aria-hidden>{props.themeEmoji}</div>
          <h1 className="text-2xl font-bold sm:text-3xl">You're invited to {props.themeName}!</h1>
          {props.hostName ? (
            <p className="mt-1 text-foreground/70">Hosted by {props.hostName}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-foreground/70">
            {props.partyDate ? <span>📅 {props.partyDate}</span> : null}
            <span>👥 {props.guestCount} guests</span>
          </div>
          {props.message ? (
            <p className="mt-4 rounded-xl bg-white/60 p-4 text-foreground/80">{props.message}</p>
          ) : null}
        </div>
      </div>

      {!rsvpDone ? (
        <form onSubmit={submitRsvp} className="card-pp mt-6 space-y-4 p-6">
          <h2 className="text-lg font-bold">RSVP to see the gift registry</h2>
          <p className="text-sm text-foreground/60">No account needed — just your name.</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Your name</label>
            <input className="input-pp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={attending} onChange={() => setAttending(true)} className="accent-brand-600" /> 🎉 Attending
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!attending} onChange={() => setAttending(false)} className="accent-brand-600" /> 😢 Can't make it
            </label>
            {attending ? (
              <label className="flex items-center gap-2 text-sm">
                Party size
                <input type="number" min={1} max={20} className="input-pp w-20" value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} />
              </label>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={submitting} className="btn-primary btn w-full py-3">
            {submitting ? "Sending…" : attending ? "RSVP & view registry →" : "Send regrets"}
          </button>
        </form>
      ) : (
        <div className="card-pp mt-6 p-4 text-center">
          <p className="font-semibold text-emerald-600">✓ Thanks{attending ? " — see you there!" : " for letting us know."}</p>
        </div>
      )}

      {rsvpDone ? (
        <div id="registry" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">🎁 Gift registry</h2>
            <span className="text-sm text-foreground/60">{available} available</span>
          </div>
          <p className="mb-4 text-sm text-foreground/60">
            Claim a gift to reserve it, then buy it from the merchant. It'll be marked so no one else duplicates it.
          </p>
          <div className="space-y-3">
            {registry.map((item) => (
              <RegistryRow key={item.id} item={item} onClaim={claim} />
            ))}
          </div>
          <div className="mt-6">
            <FtcDisclosure />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RegistryRow({ item, onClaim }: { item: GuestRegistryItem; onClaim: (i: GuestRegistryItem) => void }) {
  const claimed = item.status !== "AVAILABLE";
  return (
    <div className={cn("flex gap-4 rounded-xl border p-3", claimed ? "border-brand-50 bg-brand-50/40 opacity-70" : "border-brand-100 bg-white")}>
      <ProductTile seed={item.product.title} emoji={categoryEmoji(item.product.categorySlug)} className="h-16 w-16 shrink-0" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-medium">{item.product.title}</p>
          <p className="font-bold">{formatCurrency(item.product.price)}</p>
        </div>
        <p className="text-xs text-foreground/50">{item.product.merchantName}</p>
        {item.aiReason ? <p className="mt-1 text-sm text-foreground/70">{item.aiReason}</p> : null}
        {claimed ? (
          <p className="mt-2 text-xs font-medium text-amber-700">✓ Claimed{item.claimedBy ? " by " + item.claimedBy : ""}</p>
        ) : (
          <button onClick={() => onClaim(item)} className="btn-primary btn mt-2 px-4 py-1.5 text-xs">
            Claim this gift & buy ↗
          </button>
        )}
      </div>
    </div>
  );
}
