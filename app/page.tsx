import Link from "next/link";
import { prisma } from "@/lib/db";
import { ThemeTile } from "@/components/product-tile";
import { FtcDisclosure } from "@/components/ftc-disclosure";

export const revalidate = 3600;

export default async function HomePage() {
  const themes = await prisma.theme.findMany({ orderBy: { name: "asc" }, take: 6 });
  const productCount = await prisma.product.count({ where: { active: true } });

  return (
    <div>
      <section className="container-pp py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700">
            ✨ AI-powered party planning
          </span>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
            The party plan that <span className="gradient-text">shops itself</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-foreground/70">
            Describe your child's birthday and our AI builds a complete, budget-balanced shopping
            list from real party supplies — then a shareable event page where guests RSVP and buy
            gifts. No more guesswork.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/plan" className="btn-primary btn px-6 py-3 text-base">
              ✨ Plan a party free
            </Link>
            <Link href="/how-it-works" className="btn-secondary btn px-6 py-3 text-base">
              How it works
            </Link>
          </div>
          <p className="mt-3 text-xs text-foreground/50">No signup needed to see your plan.</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-3 gap-4 text-center">
          <Stat value={productCount + "+"} label="Real products" />
          <Stat value="6" label="Party themes" />
          <Stat value="< 15s" label="To a full plan" />
        </div>
      </section>

      <section className="border-y border-brand-100 bg-white py-16">
        <div className="container-pp">
          <h2 className="mb-2 text-center text-3xl font-bold">How it works</h2>
          <p className="mb-10 text-center text-foreground/60">Three steps to a stress-free party.</p>
          <div className="grid gap-6 md:grid-cols-3">
            <Step n="1" emoji="📝" title="Describe the party" text="Theme, guest count, and budget. Takes 30 seconds." />
            <Step n="2" emoji="🤖" title="AI builds the list" text="A budget-balanced plan from real products, with smart quantities per guest." />
            <Step n="3" emoji="🎁" title="Share & celebrate" text="Guests RSVP and buy gifts from your registry on a shareable page." />
          </div>
        </div>
      </section>

      <section className="container-pp py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold">Pick a theme</h2>
            <p className="text-foreground/60">Curated, matching supplies per theme.</p>
          </div>
          <Link href="/themes" className="btn-ghost btn text-sm">All themes →</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {themes.map((t) => (
            <Link key={t.slug} href={"/themes/" + t.slug} className="group">
              <ThemeTile seed={t.slug} emoji={t.emoji ?? "🎉"} heroColor={t.heroColor ?? "#7c3aed"} />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold group-hover:text-brand-600">{t.name}</span>
                <span className="text-brand-600 opacity-0 transition group-hover:opacity-100">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-pp pb-16">
        <div className="card-pp mx-auto max-w-3xl p-8 text-center">
          <h2 className="text-2xl font-bold">Ready to plan the perfect party?</h2>
          <p className="mt-2 text-foreground/60">It's free to start. See your AI plan before you sign up.</p>
          <Link href="/plan" className="btn-primary btn mt-5 px-6 py-3 text-base">✨ Start planning</Link>
          <div className="mt-6 text-left">
            <FtcDisclosure variant="compact" />
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-pp p-4">
      <div className="text-2xl font-extrabold text-brand-600">{value}</div>
      <div className="text-xs text-foreground/60">{label}</div>
    </div>
  );
}

function Step({ n, emoji, title, text }: { n: string; emoji: string; title: string; text: string }) {
  return (
    <div className="card-pp p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{n}</span>
        <span className="text-3xl" aria-hidden>{emoji}</span>
      </div>
      <h3 className="mb-1 font-bold">{title}</h3>
      <p className="text-sm text-foreground/60">{text}</p>
    </div>
  );
}
