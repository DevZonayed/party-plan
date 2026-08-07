import Link from "next/link";

export const revalidate = 3600;
export const metadata = {
  title: "How it works",
  description: "How PartyPlan's AI builds a complete, budget-balanced party shopping list from real products.",
};

export default function HowItWorksPage() {
  return (
    <div className="container-pp py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold sm:text-4xl">How it works</h1>
        <p className="mt-3 text-foreground/70">
          PartyPlan turns a few details about your child's birthday into a complete, budget-balanced
          shopping list drawn from real party supplies — then a shareable event page where guests RSVP
          and buy gifts.
        </p>
        <div className="mt-10 space-y-8">
          <Step n="1" title="Describe the party" text="Pick a theme, set the guest count and budget. That's it — no signup to see results." />
          <Step n="2" title="AI builds the list" text="Our recommendation engine selects real products from a curated catalog, computes the right quantities per guest (a 20-kid party needs one 50-count plate pack, not three), and balances the whole plan to your budget." />
          <Step n="3" title="Swap anything" text="Don't like an item? One tap shows theme-matched alternatives — no waiting on the AI again." />
          <Step n="4" title="Share with guests" text="Publish a shareable event page. Guests RSVP in seconds (no account) and buy gifts from your registry — every link tracked for the party." />
        </div>
        <div className="card-pp mt-10 p-6 text-center">
          <h2 className="text-xl font-bold">Ready to try it?</h2>
          <p className="mt-1 text-foreground/60">See your AI party plan before you sign up.</p>
          <Link href="/plan" className="btn-primary btn mt-4 px-6 py-3">✨ Plan a party free</Link>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{n}</span>
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="text-foreground/70">{text}</p>
      </div>
    </div>
  );
}
