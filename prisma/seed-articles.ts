import type { PrismaClient } from "@prisma/client";

type ArticleSeed = {
  slug: string;
  title: string;
  excerpt: string;
  themeSlug?: string;
  heroColor?: string;
  readMinutes: number;
  body: string;
};

const ARTICLES: ArticleSeed[] = [
  {
    slug: "how-to-plan-a-bluey-birthday-party",
    title: "How to Plan a Bluey Birthday Party on a Budget",
    excerpt: "Everything you need to throw a cheerful Bluey party for 20 kids without overspending — from tableware to favors.",
    themeSlug: "bluey",
    heroColor: "#3b82f6",
    readMinutes: 6,
    body: [
      "## Start with the theme",
      "Bluey is a crowd-pleaser for ages 2-7. The palette is cheerful blue and tan, and the show's games (keepy-uppy, featherwand) make perfect cheap activities.",
      "",
      "## What you actually need",
      "A common mistake is overbuying. For 20 guests you need roughly:",
      "- **Plates:** one 50-count pack is plenty (20 guests + spares).",
      "- **Cups:** one 50-count pack.",
      "- **Napkins:** one 100-count pack covers food and spills.",
      "- **Tablecover:** 1-2 depending on table length.",
      "- **Favors:** one 24-pack favor set, topped up with a few extras.",
      "",
      "> The single biggest money-saver is buying by pack quantity, not by item. A 50-count plate pack costs less per plate than any smaller pack.",
      "",
      "## Let AI build the list",
      "Instead of guessing, describe your party and let the planner build a budget-balanced shopping list from real products. You can swap any item before you buy.",
      "",
      "## Keep it under $200",
      "With near-wholesale party supplies, a complete 20-guest Bluey party — tableware, balloons, banner, favors, and cake topper — lands around $60-90. That leaves room in a $180 budget for cake and a small gift.",
    ].join("\n"),
  },
  {
    slug: "spider-man-party-ideas-for-kids",
    title: "Spider-Man Party Ideas Kids Will Love",
    excerpt: "Web-slinging decor, color coordination, and activity ideas for an action-packed Spider-Man birthday.",
    themeSlug: "spiderman",
    heroColor: "#dc2626",
    readMinutes: 5,
    body: [
      "## Lean into red and blue",
      "Spider-Man's signature colors make coordination easy. Solid red and blue tableware is cheaper than branded sets and looks just as striking.",
      "",
      "## Decor that pops",
      "- A web backdrop for photos.",
      "- Red and blue balloon bouquets.",
      "- A 'Happy Birthday' banner in hero colors.",
      "",
      "## Activities",
      "- 'Pin the spider on the web.'",
      "- A balloon 'keep the web (balloon) in the air' game.",
      "",
      "## Favor bags",
      "A 24-pack favor set plus a sticker roll split across bags keeps every guest happy without per-item shopping.",
    ].join("\n"),
  },
  {
    slug: "unicorn-party-theme-guide",
    title: "Unicorn Party Theme: Everything You Need",
    excerpt: "Pastels, rainbows, and a touch of magic — your complete unicorn party planning guide.",
    themeSlug: "unicorn",
    heroColor: "#a855f7",
    readMinutes: 5,
    body: [
      "## The unicorn palette",
      "Purple, pink, and rainbow accents. Pastel tableware with a rainbow balloon arch sets the scene instantly.",
      "",
      "## The cake is the centerpiece",
      "A unicorn cake topper set turns a plain cake into the hero of the table. Pair it with numeric candles for the age.",
      "",
      "## Magical extras",
      "- Rainbow confetti scatter.",
      "- A dreamy photo backdrop.",
      "- Sparkle sticker favors.",
      "",
      "> Pair a party kit with a couple of magical extras and you have a complete party for 20 guests in one order.",
    ].join("\n"),
  },
  {
    slug: "birthday-party-shopping-checklist",
    title: "Birthday Party Shopping Checklist by Guest Count",
    excerpt: "Exactly how many plates, cups, and favors to buy for 10, 20, or 30 guests — the math that prevents overbuying.",
    readMinutes: 7,
    body: [
      "## The golden rule: buy by pack, not by item",
      "Party supplies are sold in packs (50-count plates, 100-count napkins). Buying the right pack — not three of them — is how you stay on budget.",
      "",
      "## Quantities by guest count",
      "Add a 20% buffer for breakage and second helpings:",
      "- **10 guests:** 1 plate pack, 1 cup pack, 1 napkin pack, 1 favor set.",
      "- **20 guests:** 1 of each (50-count packs already cover 20), 1-2 tablecovers, 1 favor set + extras.",
      "- **30 guests:** 1 plate pack + 1 extra, 1 cup pack + extras, 1 napkin pack, 2 favor sets.",
      "",
      "## The per-guest math",
      "For a 50-count plate pack and 20 guests: ceil(20 x 1.2 / 50) = 1 pack. That's it. Don't buy three.",
      "",
      "## Let the planner do it",
      "Describe your party and the planner computes exact quantities from real pack sizes — so you never over- or under-buy.",
    ].join("\n"),
  },
  {
    slug: "budget-birthday-parties-how-much-to-spend",
    title: "Budget Birthday Parties: How Much Should You Spend?",
    excerpt: "A realistic breakdown of where birthday party money goes — and how near-wholesale supplies change the math.",
    readMinutes: 6,
    body: [
      "## Where the money goes",
      "A typical kids' birthday breaks down roughly: supplies 30%, cake 20%, food 25%, venue/activities 15%, favors 10%.",
      "",
      "## The supplies lever",
      "Near-wholesale party supplies (plates at $5.49 per 50, tablecovers at $1.29) are dramatically cheaper than big-box single-item packs. This is the easiest category to cut without cutting the experience.",
      "",
      "## A realistic $180 party",
      "- Tableware, cups, napkins, tablecover: ~$20.",
      "- Balloons, banner, decor: ~$20.",
      "- Favors for 20: ~$15.",
      "- Cake topper + candles: ~$10.",
      "- That's ~$65 in supplies, leaving $115 for cake, food, and a gift.",
      "",
      "> You don't need to spend more to throw a memorable party — you need to buy the right quantities from the right supplier.",
    ].join("\n"),
  },
];

export async function seedArticles(prisma: PrismaClient, siteId: string) {
  for (const a of ARTICLES) {
    await prisma.article.upsert({
      where: { siteId_slug: { siteId, slug: a.slug } },
      update: {
        title: a.title,
        excerpt: a.excerpt,
        body: a.body,
        themeId: a.themeSlug ? (await prisma.theme.findUnique({ where: { slug: a.themeSlug } }))?.id ?? null : null,
        heroColor: a.heroColor,
        readMinutes: a.readMinutes,
        publishedAt: new Date("2026-08-01"),
      },
      create: {
        siteId,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        body: a.body,
        themeId: a.themeSlug ? (await prisma.theme.findUnique({ where: { slug: a.themeSlug } }))?.id ?? null : null,
        heroColor: a.heroColor,
        readMinutes: a.readMinutes,
        publishedAt: new Date("2026-08-01"),
      },
    });
  }
  console.log("Seeded " + ARTICLES.length + " articles.");
}
