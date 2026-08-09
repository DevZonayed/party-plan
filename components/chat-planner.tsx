"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { categoryEmoji } from "@/lib/catalog/visuals";
import { ProductTile } from "@/components/product-tile";
import { FtcDisclosure } from "@/components/ftc-disclosure";
import type { HydratedItem, HydratedPlan } from "@/lib/types";

// Quick replies keep common answers fast, while the composer lets people talk
// naturally. The server interprets each message only in the context of the
// current party-planning question and re-prompts when it cannot use the answer.

interface QuickReply {
  label: string;
  value: string;
  emoji?: string;
}
interface AssistantTurn {
  text: string;
  quickReplies?: QuickReply[];
  plan?: HydratedPlan;
  draftId?: string;
}

type Step =
  | "intro"
  | "theme"
  | "guests"
  | "budget"
  | "age"
  | "location"
  | "planning"
  | "result";

interface ConvState {
  step: Step;
  themeSlug?: string;
  themeName?: string;
  themeTags?: string[];
  guestCount?: number;
  budgetTotal?: number;
  childAge?: number;
  locationType?: string;
}

interface AssistantMsg {
  id: string;
  role: "assistant";
  text: string;
  quickReplies?: QuickReply[];
  plan?: HydratedPlan;
  draftId?: string;
  consumed?: boolean;
}
interface UserMsg {
  id: string;
  role: "user";
  text: string;
}
type Msg = AssistantMsg | UserMsg;

interface SwapAlt {
  id: string;
  title: string;
  price: number;
  packQuantity: number | null;
  productUrl: string;
  affiliateUrl: string | null;
  imageUrl: string;
  merchantName: string;
  categoryId: string | null;
}

let counter = 0;
const uid = () => "m" + ++counter;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ChatPlanner() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [state, setState] = useState<ConvState>({ step: "intro" });
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [draft, setDraft] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<{ msgId: string; itemId: string } | null>(null);
  const [alts, setAlts] = useState<SwapAlt[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy, planning, swapFor]);

  const pushAssistant = useCallback((turn: AssistantTurn) => {
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "assistant", text: turn.text, quickReplies: turn.quickReplies, plan: turn.plan, draftId: turn.draftId, consumed: false },
    ]);
  }, []);

  const send = useCallback(
    async (answer: string | null, label: string | null, fromState?: ConvState, message?: string) => {
      const baseState = fromState ?? state;
      if (busy) return;

      if (label !== null) {
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            const m = next[i];
            if (m.role === "assistant" && m.quickReplies && m.quickReplies.length) {
              next[i] = { ...m, consumed: true };
              break;
            }
          }
          return [...next, { id: uid(), role: "user", text: label } as UserMsg];
        });
      }

      const willPlan = baseState.step === "location" || (baseState.step === "result" && answer === "regenerate");
      setBusy(true);
      if (willPlan) setPlanning(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: baseState, answer, message }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Something went wrong");

        setState(data.state as ConvState);
        const turns: AssistantTurn[] = data.turns ?? [];
        for (const turn of turns) {
          await wait(turn.plan ? 200 : 460);
          setPlanning(false);
          pushAssistant(turn);
        }
        setPlanning(false);
      } catch {
        setPlanning(false);
        setState((s) => (s.step === "location" ? { ...s, step: "result" } : s));
        pushAssistant({
          text: "Hmm, I hit a snag there. 🛠️ Let's start fresh — tap below.",
          quickReplies: [{ label: "↩️ Start over", value: "restart" }],
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, state, pushAssistant],
  );

  // Kick off the greeting once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void send(null, null, { step: "intro" });
  }, [send]);

  function submitMessage() {
    const message = draft.trim();
    if (!message || busy || planning) return;
    setDraft("");
    void send(null, message, undefined, message);
  }

  async function doSwap(msgId: string, itemId: string, themeSlug?: string) {
    setSwapFor({ msgId, itemId });
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

  function applySwap(msgId: string, catSlug: string, oldItemId: string, alt: SwapAlt) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || m.role !== "assistant" || !m.plan) return m;
        const next = structuredClone(m.plan) as HydratedPlan;
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
        return { ...m, plan: next };
      }),
    );
    setSwapFor(null);
    setAlts(null);
    setDraft("");
  }

  async function publish(draftId: string) {
    setPublishingId(draftId);
    try {
      const res = await fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      const j = await res.json();
      if (j.registryUrl) router.push(j.registryUrl);
    } catch {
      /* ignore */
    } finally {
      setPublishingId(null);
    }
  }

  function restart() {
    setMessages([]);
    setState({ step: "intro" });
    setSwapFor(null);
    setAlts(null);
    startedRef.current = false;
    setTimeout(() => {
      startedRef.current = true;
      void send(null, null, { step: "intro" });
    }, 30);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
        <div className="relative">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-xl">🎈</span>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="font-bold leading-tight">Pippa · AI Party Planner</p>
          <p className="text-xs text-emerald-600">● Online — type a message or use suggestions</p>
        </div>
        <button onClick={restart} className="btn-ghost btn ml-auto px-3 py-1.5 text-xs">↺ Restart</button>
      </div>

      <div ref={scrollRef} className="card-pp flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[88%] space-y-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-lg">🎈</span>
                  <div className="rounded-2xl rounded-bl-md bg-brand-50 px-4 py-2.5 text-sm text-foreground shadow-sm">
                    {m.text}
                  </div>
                </div>
                {m.quickReplies && m.quickReplies.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pl-7">
                    {m.quickReplies.map((qr) => {
                      const disabled = busy || m.consumed;
                      return (
                        <button
                          key={qr.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => void send(qr.value, (qr.emoji ? qr.emoji + " " : "") + qr.label)}
                          className={cn(
                            "rounded-full border px-3.5 py-2 text-sm font-semibold transition active:scale-95",
                            disabled
                              ? "cursor-not-allowed border-brand-100 bg-brand-50/50 text-foreground/40"
                              : "border-brand-300 bg-white text-brand-700 hover:border-brand-500 hover:bg-brand-50",
                          )}
                        >
                          {qr.emoji ? <span className="mr-1">{qr.emoji}</span> : null}
                          {qr.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {m.plan ? (
                  <div className="pl-7">
                    <PlanCard
                      msgId={m.id}
                      plan={m.plan}
                      draftId={m.draftId}
                      themeSlug={state.themeSlug}
                      swapFor={swapFor}
                      alts={alts}
                      publishing={publishingId === m.draftId}
                      onSwap={doSwap}
                      onApplySwap={applySwap}
                      onCloseSwap={() => {
                        setSwapFor(null);
                        setAlts(null);
                      }}
                      onPublish={publish}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ),
        )}

        {planning ? (
          <div className="flex items-center gap-2 text-sm text-foreground/70">
            <span className="text-lg">🎈</span>
            <div className="rounded-2xl rounded-bl-md bg-brand-50 px-4 py-2.5 shadow-sm">
              <span className="mr-2">Building your party plan</span>
              <span className="inline-flex gap-1 align-middle">
                {["🎂", "🎁", "🎉"].map((e, i) => (
                  <span key={i} className="inline-block animate-bounce" style={{ animationDelay: i * 0.15 + "s" }}>
                    {e}
                  </span>
                ))}
              </span>
            </div>
          </div>
        ) : busy ? (
          <div className="flex items-center gap-2">
            <span className="text-lg">🎈</span>
            <div className="rounded-2xl rounded-bl-md bg-brand-50 px-4 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "0.15s" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "0.3s" }} />
              </span>
            </div>
          </div>
        ) : null}

        <div className="h-2" />
      </div>

      <form
        className="mt-3 rounded-2xl border border-brand-100 bg-white p-2 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          submitMessage();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 500))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
              }
            }}
            placeholder="Message Pippa about your party…"
            aria-label="Message Pippa"
            rows={1}
            disabled={busy || planning}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-brand-200 bg-brand-50/30 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-foreground/40 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || planning || draft.trim().length === 0}
            aria-label="Send message"
            className="btn-primary btn h-11 w-11 shrink-0 rounded-xl p-0 text-lg"
          >
            ↑
          </button>
        </div>
        <p className="px-1 pt-1.5 text-xs text-foreground/45">
          Press Enter to send · Quick suggestions are optional · Party-planning messages only
        </p>
      </form>
    </div>
  );
}

function PlanCard(props: {
  msgId: string;
  plan: HydratedPlan;
  draftId?: string;
  themeSlug?: string;
  swapFor: { msgId: string; itemId: string } | null;
  alts: SwapAlt[] | null;
  publishing: boolean;
  onSwap: (msgId: string, itemId: string, themeSlug?: string) => void;
  onApplySwap: (msgId: string, catSlug: string, oldItemId: string, alt: SwapAlt) => void;
  onCloseSwap: () => void;
  onPublish: (draftId: string) => void;
}) {
  const { plan, msgId } = props;
  const pct = Math.min(100, Math.round((plan.total / plan.budgetTotal) * 100));
  return (
    <div className="space-y-4 rounded-2xl border border-brand-200 bg-white p-4 text-left shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">🛍️ Your shopping plan</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            plan.source === "ai" ? "bg-brand-100 text-brand-700" : plan.source === "cached" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-800",
          )}
        >
          {plan.source === "ai" ? "✨ AI-built" : plan.source === "cached" ? "Cached" : "Curated"}
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground/70">Total</span>
          <span className={cn("font-bold", plan.withinBudget ? "text-emerald-600" : "text-red-600")}>
            {formatCurrency(plan.total)} / {formatCurrency(plan.budgetTotal)}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-100">
          <div className={cn("h-full rounded-full", plan.withinBudget ? "bg-emerald-500" : "bg-red-500")} style={{ width: pct + "%" }} />
        </div>
        {plan.shippingWarning ? <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">⚠️ {plan.shippingWarning}</p> : null}
        {plan.notes ? <p className="mt-2 text-xs text-foreground/70">{plan.notes}</p> : null}
      </div>

      <div className="space-y-3">
        {plan.categories.map((cat) => (
          <div key={cat.slug} className="rounded-xl border border-brand-50 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <span aria-hidden>{categoryEmoji(cat.slug)}</span> {cat.name}
              </p>
              <span className="text-xs text-foreground/50">{formatCurrency(cat.subtotal)}</span>
            </div>
            <div className="space-y-2">
              {cat.items.map((item) => {
                const isSwap = props.swapFor?.msgId === msgId && props.swapFor?.itemId === item.productId;
                return (
                  <div key={item.productId} className="flex gap-2.5 rounded-lg bg-brand-50/40 p-2">
                    <ProductTile seed={item.product.title} emoji={categoryEmoji(cat.slug)} className="h-14 w-14 shrink-0" size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">{item.product.title}</p>
                        <p className="shrink-0 text-sm font-bold">{formatCurrency(item.lineTotal)}</p>
                      </div>
                      <p className="text-xs text-foreground/50">{formatCurrency(item.product.price)} × {item.quantity} · {item.unitLabel}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-foreground/60">{item.reason}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <a
                          href={item.product.affiliateUrl || item.product.productUrl || "#"}
                          target="_blank"
                          rel="noopener nofollow sponsored"
                          className="btn-secondary btn px-2.5 py-1 text-xs"
                        >
                          Shop ↗
                        </a>
                        <button onClick={() => props.onSwap(msgId, item.productId, props.themeSlug)} className="btn-ghost btn px-2.5 py-1 text-xs">
                          ↺ Swap
                        </button>
                      </div>
                      {isSwap ? (
                        <div className="mt-2 rounded-lg border border-brand-100 bg-white p-2">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground/70">Swap with:</span>
                            <button onClick={props.onCloseSwap} className="text-xs text-foreground/40 hover:text-foreground">close</button>
                          </div>
                          {props.alts === null ? (
                            <p className="text-xs text-foreground/50">Finding alternatives…</p>
                          ) : props.alts.length === 0 ? (
                            <p className="text-xs text-foreground/50">No other options in this category.</p>
                          ) : (
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {props.alts.map((alt) => (
                                <button
                                  key={alt.id}
                                  onClick={() => props.onApplySwap(msgId, cat.slug, item.productId, alt)}
                                  className="flex items-center justify-between gap-1.5 rounded-md border border-brand-100 bg-white px-2 py-1 text-left text-xs hover:border-brand-400"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">{alt.title}</span>
                                    <span className="text-foreground/50">{alt.merchantName}</span>
                                  </span>
                                  <span className="shrink-0 font-bold">{formatCurrency(alt.price)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <FtcDisclosure />

      {props.draftId ? (
        <button
          onClick={() => props.onPublish(props.draftId!)}
          disabled={props.publishing}
          className="btn-primary btn w-full py-2.5"
        >
          {props.publishing ? "Creating event page…" : "💌 Save & create shareable event page"}
        </button>
      ) : null}
    </div>
  );
}
