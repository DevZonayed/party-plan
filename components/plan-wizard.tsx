"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { categoryEmoji } from "@/lib/catalog/visuals";
import { ProductTile } from "@/components/product-tile";
import { FtcDisclosure } from "@/components/ftc-disclosure";
import type { HydratedItem, HydratedPlan } from "@/lib/types";

export type ThemeOption = {
  slug: string;
  name: string;
  emoji: string;
  heroColor: string;
  blurb: string;
  ageMin: number | null;
  ageMax: number | null;
};

type Phase = "form" | "generating" | "results";

type SwapAlt = {
  id: string;
  title: string;
  price: number;
  packQuantity: number | null;
  productUrl: string;
  affiliateUrl: string | null;
  imageUrl: string;
  merchantName: string;
  categoryId: string | null;
};

export function PlanWizard({ themes }: { themes: ThemeOption[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("form");
  const [themeSlug, setThemeSlug] = useState(themes[0]?.slug ?? "");
  const [guestCount, setGuestCount] = useState(20);
  const [budget, setBudget] = useState(180);
  const [childAge, setChildAge] = useState<number | "">("");
  const [childName, setChildName] = useState("");
  const [partyDate, setPartyDate] = useState("");
  const [liveText, setLiveText] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState<HydratedPlan | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [alts, setAlts] = useState<SwapAlt[] | null>(null);
  const [publishing, setPublishing] = useState(false);

  const theme = themes.find((t) => t.slug === themeSlug);

  async function generate() {
    setPhase("generating");
    setError(null);
    setLiveText("");
    setPlan(null);
    setStatus("Analyzing your theme and guest count…");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeSlug,
          guestCount,
          budgetTotal: budget,
          childAge: childAge === "" ? undefined : childAge,
          childName: childName || undefined,
          partyDate: partyDate || undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Request failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const ev = parseSSE(part);
          if (!ev) continue;
          if (ev.event === "status") setStatus((ev.data as { message: string }).message);
          else if (ev.event === "token") setLiveText((ev.data as { full: string }).full.slice(-1200));
          else if (ev.event === "done") {
            const d = ev.data as { plan: HydratedPlan; draftId: string };
            setPlan(d.plan);
            setDraftId(d.draftId);
            setPhase("results");
          } else if (ev.event === "error") {
            throw new Error((ev.data as { message: string }).message);
          }
        }
      }
    } catch (e) {
      setError((e as Error).message || "Something went wrong");
      setPhase("form");
    }
  }

  async function doSwap(catSlug: string, itemId: string) {
    if (!plan) return;
    setSwapFor(itemId);
    setAlts(null);
    try {
      const res = await fetch("/api/recommend/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: itemId, themeSlug }),
      });
      const j = await res.json();
      setAlts(j.alternatives ?? []);
    } catch {
      setAlts([]);
    }
  }

  function applySwap(catSlug: string, oldItemId: string, alt: SwapAlt) {
    if (!plan) return;
    const next = structuredClone(plan) as HydratedPlan;
    for (const cat of next.categories) {
      if (cat.slug !== catSlug) continue;
      const idx = cat.items.findIndex((i) => i.productId === oldItemId);
      if (idx === -1) continue;
      const old = cat.items[idx];
      const newItem: HydratedItem = {
        productId: alt.id,
        quantity: old.quantity,
        reason: old.reason,
        product: {
          id: alt.id,
          title: alt.title,
          imageUrl: alt.imageUrl,
          price: alt.price,
          packQuantity: alt.packQuantity,
          productUrl: alt.productUrl,
          affiliateUrl: alt.affiliateUrl,
          merchantName: alt.merchantName,
        },
        lineTotal: Math.round(alt.price * old.quantity * 100) / 100,
        unitLabel: old.unitLabel,
      };
      cat.items[idx] = newItem;
      cat.subtotal = Math.round(cat.items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
    }
    next.total = Math.round(next.categories.reduce((s, c) => s + c.subtotal, 0) * 100) / 100;
    next.withinBudget = next.total <= next.budgetTotal + 0.5;
    setPlan(next);
    setSwapFor(null);
    setAlts(null);
  }

  async function publish() {
    if (!draftId) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, hostName: childName ? childName + "'s parent" : undefined }),
      });
      const j = await res.json();
      if (j.registryUrl) router.push(j.registryUrl);
    } catch {
      setPublishing(false);
    }
  }

  if (phase === "form") {
    return (
      <FormView
        themes={themes}
        themeSlug={themeSlug}
        setThemeSlug={setThemeSlug}
        guestCount={guestCount}
        setGuestCount={setGuestCount}
        budget={budget}
        setBudget={setBudget}
        childAge={childAge}
        setChildAge={setChildAge}
        childName={childName}
        setChildName={setChildName}
        partyDate={partyDate}
        setPartyDate={setPartyDate}
        error={error}
        onGenerate={generate}
      />
    );
  }

  if (phase === "generating") {
    return (
      <div className="container-pp py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 flex justify-center gap-2">
            {["🎉", "🎈", "🎂", "🎁"].map((e, i) => (
              <span key={i} className="text-4xl" style={{ animation: "float 6s ease-in-out infinite", animationDelay: i * 0.4 + "s" }}>
                {e}
              </span>
            ))}
          </div>
          <h2 className="text-2xl font-bold">{status || "Building your plan…"}</h2>
          <p className="mt-2 text-foreground/60">
            Our AI is selecting real products for a {theme?.name} party for {guestCount} guests within a {formatCurrency(budget)} budget.
          </p>
          {liveText ? (
            <pre className="mx-auto mt-8 max-h-64 max-w-xl overflow-hidden rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-left text-xs text-brand-700/80">
              {liveText}
              <span className="animate-pulse">▋</span>
            </pre>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="container-pp py-10">
      {plan ? (
        <ResultsView
          plan={plan}
          themeName={theme?.name ?? ""}
          onSwap={doSwap}
          swapFor={swapFor}
          alts={alts}
          onApplySwap={applySwap}
          onCloseSwap={() => {
            setSwapFor(null);
            setAlts(null);
          }}
          onPublish={publish}
          publishing={publishing}
        />
      ) : null}
    </div>
  );
}

function FormView(props: {
  themes: ThemeOption[];
  themeSlug: string;
  setThemeSlug: (v: string) => void;
  guestCount: number;
  setGuestCount: (v: number) => void;
  budget: number;
  setBudget: (v: number) => void;
  childAge: number | "";
  setChildAge: (v: number | "") => void;
  childName: string;
  setChildName: (v: string) => void;
  partyDate: string;
  setPartyDate: (v: string) => void;
  error: string | null;
  onGenerate: () => void;
}) {
  const t = props.themes.find((x) => x.slug === props.themeSlug);
  return (
    <div className="container-pp py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Plan your party in 30 seconds</h1>
          <p className="mt-3 text-foreground/60">
            Tell us about the party. Our AI builds a complete, budget-balanced shopping list from real party supplies — no signup needed to see results.
          </p>
        </div>
        <div className="card-pp space-y-8 p-6 sm:p-8">
          <div>
            <label className="mb-3 block font-semibold">1. Pick a theme</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {props.themes.map((th) => (
                <button
                  key={th.slug}
                  type="button"
                  onClick={() => props.setThemeSlug(th.slug)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition",
                    props.themeSlug === th.slug ? "border-brand-500 bg-brand-50" : "border-brand-100 bg-white hover:border-brand-300"
                  )}
                >
                  <span className="text-3xl" aria-hidden>{th.emoji}</span>
                  <span className="text-sm font-medium">{th.name}</span>
                </button>
              ))}
            </div>
            {t ? <p className="mt-3 text-sm text-foreground/60">{t.blurb}</p> : null}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 flex items-center justify-between font-semibold">
                <span>2. Guest count</span>
                <span className="text-brand-600">{props.guestCount}</span>
              </label>
              <input type="range" min={5} max={100} step={1} value={props.guestCount} onChange={(e) => props.setGuestCount(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
            <div>
              <label className="mb-2 flex items-center justify-between font-semibold">
                <span>3. Budget</span>
                <span className="text-brand-600">{formatCurrency(props.budget)}</span>
              </label>
              <input type="range" min={40} max={800} step={10} value={props.budget} onChange={(e) => props.setBudget(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
          </div>
          <details className="rounded-xl border border-brand-100 p-4">
            <summary className="cursor-pointer font-semibold text-foreground/70">Optional details</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Child's name</label>
                <input className="input-pp" value={props.childName} onChange={(e) => props.setChildName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Child's age</label>
                <input type="number" min={0} max={18} className="input-pp" value={props.childAge} onChange={(e) => props.setChildAge(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Optional" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Party date</label>
                <input type="date" className="input-pp" value={props.partyDate} onChange={(e) => props.setPartyDate(e.target.value)} />
              </div>
            </div>
          </details>
          {props.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{props.error}</div> : null}
          <button onClick={props.onGenerate} className="btn-primary btn w-full py-3 text-base">✨ Generate my party plan</button>
          <p className="text-center text-xs text-foreground/50">No signup required to see your plan.</p>
        </div>
      </div>
    </div>
  );
}

function ResultsView(props: {
  plan: HydratedPlan;
  themeName: string;
  onSwap: (catSlug: string, itemId: string) => void;
  swapFor: string | null;
  alts: SwapAlt[] | null;
  onApplySwap: (catSlug: string, oldItemId: string, alt: SwapAlt) => void;
  onCloseSwap: () => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  const { plan } = props;
  const pct = Math.min(100, Math.round((plan.total / plan.budgetTotal) * 100));
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Your {props.themeName} party plan</h1>
          <p className="text-foreground/60">AI-built, budget-balanced, from real products. Swap anything.</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", plan.source === "ai" ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-800")}>
          {plan.source === "ai" ? "✨ AI-generated" : plan.source === "cached" ? "Cached" : "Curated picks"}
        </span>
      </div>
      <div className="card-pp mb-6 p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">Estimated total</span>
          <span className={cn("font-bold", plan.withinBudget ? "text-emerald-600" : "text-red-600")}>
            {formatCurrency(plan.total)} / {formatCurrency(plan.budgetTotal)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-brand-100">
          <div className={cn("h-full rounded-full", plan.withinBudget ? "bg-emerald-500" : "bg-red-500")} style={{ width: pct + "%" }} />
        </div>
        {plan.shippingWarning ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">⚠️ {plan.shippingWarning}</p> : null}
        {plan.notes ? <p className="mt-3 text-sm text-foreground/70">{plan.notes}</p> : null}
      </div>
      <div className="space-y-6">
        {plan.categories.map((cat) => (
          <div key={cat.slug} className="card-pp p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <span aria-hidden>{categoryEmoji(cat.slug)}</span> {cat.name}
              </h2>
              <span className="text-sm text-foreground/60">{formatCurrency(cat.subtotal)}</span>
            </div>
            <div className="space-y-3">
              {cat.items.map((item) => (
                <ItemRow
                  key={item.productId}
                  catSlug={cat.slug}
                  item={item}
                  onSwap={props.onSwap}
                  isSwapping={props.swapFor === item.productId}
                  alts={props.swapFor === item.productId ? props.alts : null}
                  onApplySwap={props.onApplySwap}
                  onCloseSwap={props.onCloseSwap}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <FtcDisclosure />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button onClick={props.onPublish} disabled={props.publishing} className="btn-primary btn flex-1 py-3">
          {props.publishing ? "Creating event page…" : "🎉 Save & create shareable event page"}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-foreground/50">Creates a shareable page where guests can RSVP and buy gifts from your registry.</p>
    </div>
  );
}

function ItemRow(props: {
  catSlug: string;
  item: HydratedItem;
  onSwap: (catSlug: string, itemId: string) => void;
  isSwapping: boolean;
  alts: SwapAlt[] | null;
  onApplySwap: (catSlug: string, oldItemId: string, alt: SwapAlt) => void;
  onCloseSwap: () => void;
}) {
  const { item } = props;
  return (
    <div className="flex gap-4 rounded-xl border border-brand-50 p-3">
      <ProductTile seed={item.product.title} emoji={categoryEmoji(props.catSlug)} className="h-20 w-20 shrink-0" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{item.product.title}</p>
            <p className="text-xs text-foreground/50">{item.product.merchantName}</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{formatCurrency(item.lineTotal)}</p>
            <p className="text-xs text-foreground/50">{formatCurrency(item.product.price)} × {item.quantity}</p>
          </div>
        </div>
        <p className="mt-1 text-sm text-foreground/70">{item.reason}</p>
        <p className="mt-1 text-xs text-brand-600">{item.unitLabel}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={item.product.affiliateUrl || item.product.productUrl || "#"} target="_blank" rel="noopener nofollow sponsored" className="btn-secondary btn px-3 py-1.5 text-xs">
            View at {item.product.merchantName} ↗
          </a>
          <button onClick={() => props.onSwap(props.catSlug, item.productId)} className="btn-ghost btn px-3 py-1.5 text-xs">↺ Swap</button>
        </div>
        {props.isSwapping ? (
          <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground/70">Swap with:</span>
              <button onClick={props.onCloseSwap} className="text-xs text-foreground/50 hover:text-foreground">close</button>
            </div>
            {props.alts === null ? (
              <p className="text-xs text-foreground/50">Finding alternatives…</p>
            ) : props.alts.length === 0 ? (
              <p className="text-xs text-foreground/50">No other options in this category.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {props.alts.map((alt) => (
                  <button key={alt.id} onClick={() => props.onApplySwap(props.catSlug, item.productId, alt)} className="flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2 text-left text-xs hover:border-brand-400">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{alt.title}</span>
                      <span className="text-foreground/50">{alt.merchantName}</span>
                    </span>
                    <span className="font-bold">{formatCurrency(alt.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function parseSSE(chunk: string): { event: string; data: unknown } | null {
  let event = "message";
  let data = "";
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}
