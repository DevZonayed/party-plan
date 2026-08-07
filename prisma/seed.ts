import { PrismaClient } from "@prisma/client";
import { parsePackQuantity } from "../lib/catalog/pack-quantity";

const prisma = new PrismaClient();

type ThemeSeed = {
  name: string;
  slug: string;
  tags: string[];
  aliases: string[];
  ageMin?: number;
  ageMax?: number;
  heroColor: string;
  emoji: string;
  blurb: string;
};

const THEMES: ThemeSeed[] = [
  { name: "Bluey", slug: "bluey", tags: ["bluey", "blue-heeler", "puppy", "australian"], aliases: ["bluey", "blue heeler"], ageMin: 2, ageMax: 7, heroColor: "#3b82f6", emoji: "🐶", blurb: "For the littlest Bluey fans — everything blue, cheerful, and ready for a game of keepy-uppy." },
  { name: "Spider-Man", slug: "spiderman", tags: ["spiderman", "spider-man", "superhero", "marvel", "web"], aliases: ["spiderman", "spider-man", "spidey"], ageMin: 4, ageMax: 10, heroColor: "#dc2626", emoji: "🕷️", blurb: "Web-slinging hero party in bold red and blue. Perfect for action-loving kids." },
  { name: "Enchanted Unicorn", slug: "unicorn", tags: ["unicorn", "magical", "rainbow", "fantasy"], aliases: ["unicorn", "magical"], ageMin: 3, ageMax: 9, heroColor: "#a855f7", emoji: "🦄", blurb: "Dreamy pastels, rainbows, and a touch of magic for a birthday they'll never forget." },
  { name: "Disney Princess", slug: "princess", tags: ["princess", "disney-princess", "fairy-tale", "royal"], aliases: ["princess", "disney princess"], ageMin: 3, ageMax: 9, heroColor: "#ec4899", emoji: "👸", blurb: "A royal celebration in pink and gold fit for your little princess." },
  { name: "Dinosaur Adventure", slug: "dinosaur", tags: ["dinosaur", "dino", "jurassic", "t-rex"], aliases: ["dinosaur", "dino", "t-rex"], ageMin: 3, ageMax: 10, heroColor: "#16a34a", emoji: "🦖", blurb: "Stomp, roar, and explore with a prehistoric party full of greens and golds." },
  { name: "Space Explorer", slug: "space", tags: ["space", "astronaut", "galaxy", "rocket", "stars"], aliases: ["space", "astronaut", "galaxy"], ageMin: 4, ageMax: 12, heroColor: "#1e3a8a", emoji: "🚀", blurb: "Blast off to the stars with a galaxy-themed adventure across deep navy and silver." },
];

type CatSeed = { slug: string; name: string; icon: string; perGuest: boolean; essential: boolean; sortOrder: number };
const CATEGORIES: CatSeed[] = [
  { slug: "tableware", name: "Plates & Tableware", icon: "🍽️", perGuest: true, essential: true, sortOrder: 1 },
  { slug: "cups", name: "Cups", icon: "🥤", perGuest: true, essential: true, sortOrder: 2 },
  { slug: "napkins", name: "Napkins", icon: "🧻", perGuest: true, essential: true, sortOrder: 3 },
  { slug: "tablecloths", name: "Tablecovers", icon: "🖼️", perGuest: false, essential: true, sortOrder: 4 },
  { slug: "balloons", name: "Balloons", icon: "🎈", perGuest: false, essential: false, sortOrder: 5 },
  { slug: "decorations", name: "Banners & Decor", icon: "🎊", perGuest: false, essential: false, sortOrder: 6 },
  { slug: "favors", name: "Party Favors", icon: "🎁", perGuest: true, essential: false, sortOrder: 7 },
  { slug: "cake", name: "Cake & Treats", icon: "🎂", perGuest: false, essential: false, sortOrder: 8 },
];

// Per-category product spec for a themed product.
type Spec = {
  cat: string;
  title: (theme: string) => string;
  price: number;
  pack: number | null;
  compareAt?: number;
  desc: (theme: string) => string;
};
const THEMED_SPECS: Spec[] = [
  { cat: "tableware", title: (t) => t + " 9 in. Paper Plates | 50 Count", price: 5.49, pack: 50, compareAt: 8.99, desc: (t) => t + " themed 9-inch paper plates, sturdy and food-safe. Pack of 50 covers a full party table." },
  { cat: "cups", title: (t) => t + " 9 oz. Paper Cups | 50 Count", price: 6.99, pack: 50, desc: (t) => t + " printed hot/cold cups. 50 per pack for drinks at the table." },
  { cat: "napkins", title: (t) => t + " Luncheon Napkins | 100 Count", price: 3.99, pack: 100, desc: (t) => "Soft 2-ply " + t + " napkins, 100 per pack — enough for food and spills." },
  { cat: "tablecloths", title: (t) => t + " Plastic Tablecover | 54 x 108 in.", price: 1.49, pack: 1, desc: (t) => t + " disposable plastic tablecover fits standard 6-ft tables, wipes clean." },
  { cat: "balloons", title: (t) => t + " Foil & Latex Balloon Bouquet | 5 Pack", price: 7.99, pack: 5, desc: (t) => "Coordinated " + t + " balloon set: 1 foil + 4 latex. Helium or air." },
  { cat: "decorations", title: (t) => t + " Happy Birthday Banner & Backdrop Set", price: 8.99, pack: 1, desc: (t) => t + " banner plus a photo backdrop for the cake table." },
  { cat: "favors", title: (t) => t + " Party Favor Set | 24 Pack", price: 12.99, pack: 24, compareAt: 17.99, desc: (t) => "Pre-filled " + t + " favor kit, 24 pieces — one per guest bag." },
  { cat: "cake", title: (t) => t + " Cake Topper & Candle Set", price: 6.49, pack: 1, desc: (t) => t + " cake topper with matching birthday candles." },
];

// Generic (neutral) filler specs — no theme tags, used as value alternatives.
const GENERIC_SPECS: Spec[] = [
  { cat: "tableware", title: () => "Solid Color 9 in. Paper Plates | 50 Count", price: 4.29, pack: 50, desc: () => "Plain color plates, 50 count — a budget-friendly tableware staple." },
  { cat: "cups", title: () => "Solid Color 9 oz. Cups | 50 Count", price: 5.49, pack: 50, desc: () => "Plain color cups, 50 count." },
  { cat: "napkins", title: () => "Solid Color Luncheon Napkins | 100 Count", price: 2.99, pack: 100, desc: () => "Plain color napkins, 100 count." },
  { cat: "tablecloths", title: () => "Solid Color Plastic Tablecover | 54 x 108 in.", price: 1.29, pack: 1, desc: () => "Budget solid-color tablecover." },
  { cat: "balloons", title: () => "Assorted Latex Balloons | 50 Count", price: 4.99, pack: 50, desc: () => "Mixed-color latex balloons, 50 count." },
  { cat: "favors", title: () => "Mini Bubble Favor Bottles | 24 Pack", price: 8.49, pack: 24, desc: () => "Classic bubble party favors, 24 per pack — a hit with younger kids." },
];

// Anchor party kits per theme (high-value bundle).
function kitSpec(t: ThemeSeed): Spec {
  return {
    cat: "decorations",
    title: (name) => name + " Complete Party Kit for 20 Guests",
    price: 24.99,
    pack: 1,
    compareAt: 34.99,
    desc: () => t.name + " all-in-one party kit sized for 20 guests — plates, cups, napkins, tablecover, balloons, and decor included.",
  };
}

async function main() {
  // Site
  const site = await prisma.site.upsert({
    where: { slug: "birthday" },
    update: {},
    create: {
      slug: "birthday",
      name: "PartyPlan",
      tagline: "Plan the perfect kids' birthday — AI does the shopping list.",
      config: {
        brandName: "PartyPlan",
        tagline: "Plan the perfect kids' birthday — AI does the shopping list.",
        primaryColor: "#7c3aed",
        accentColor: "#ec4899",
        childLabel: "child",
        hasAge: true,
        defaultBudget: 180,
        emoji: "🎉",
      },
    },
  });

  // Merchants (both on Impact per PRD supply research)
  const fdp = await prisma.merchant.upsert({
    where: { id: "merchant-fdp" },
    update: {},
    create: {
      id: "merchant-fdp",
      name: "Factory Direct Party",
      network: "impact",
      shopDomain: "factorydirectparty.com",
      commissionPct: 7,
      cookieDays: 30,
      feedUrl: "https://factorydirectparty.com/products.json",
      linkTemplate: "https://impact.com/go?subId1={subId1}&subId2={subId2}&u={u}",
      active: true,
    },
  });
  await prisma.merchant.upsert({
    where: { id: "merchant-ot" },
    update: {},
    create: {
      id: "merchant-ot",
      name: "Oriental Trading",
      network: "impact",
      commissionPct: 5,
      cookieDays: 7,
      linkTemplate: "https://impact.com/go?subId1={subId1}&subId2={subId2}&u={u}",
      active: true,
    },
  });

  // Categories
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, perGuest: c.perGuest, essential: c.essential, sortOrder: c.sortOrder, siteId: site.id },
      create: { slug: c.slug, name: c.name, icon: c.icon, perGuest: c.perGuest, essential: c.essential, sortOrder: c.sortOrder, siteId: site.id },
    });
  }

  // Themes
  for (const t of THEMES) {
    await prisma.theme.upsert({
      where: { slug: t.slug },
      update: { name: t.name, tags: t.tags, aliases: t.aliases, ageMin: t.ageMin, ageMax: t.ageMax, heroColor: t.heroColor, emoji: t.emoji, blurb: t.blurb, siteId: site.id },
      create: { slug: t.slug, name: t.name, tags: t.tags, aliases: t.aliases, ageMin: t.ageMin, ageMax: t.ageMax, heroColor: t.heroColor, emoji: t.emoji, blurb: t.blurb, siteId: site.id },
    });
  }

  const cats = await prisma.category.findMany();
  const catMap = new Map(cats.map((c) => [c.slug, c.id]));

  let count = 0;
  const upsertProduct = async (externalId: string, data: {
    merchantId: string;
    title: string;
    description: string;
    price: number;
    compareAt?: number;
    pack: number | null;
    categoryId: string;
    themeTags: string[];
    colorTags: string[];
    productUrl: string;
  }) => {
    const parsed = data.pack ?? parsePackQuantity(data.title);
    await prisma.product.upsert({
      where: { merchantId_externalId: { merchantId: data.merchantId, externalId } },
      update: {
        title: data.title,
        description: data.description,
        price: data.price,
        compareAtPrice: data.compareAt ?? null,
        packQuantity: parsed,
        categoryId: data.categoryId,
        themeTags: data.themeTags,
        colorTags: data.colorTags,
        productUrl: data.productUrl,
        priceUpdatedAt: new Date(),
        inStock: true,
        active: true,
      },
      create: {
        merchantId: data.merchantId,
        externalId,
        title: data.title,
        description: data.description,
        price: data.price,
        compareAtPrice: data.compareAt ?? null,
        packQuantity: parsed,
        categoryId: data.categoryId,
        themeTags: data.themeTags,
        colorTags: data.colorTags,
        productUrl: data.productUrl,
        imageUrl: "",
        imageUrls: [],
      },
    });
    count++;
  };

  // Themed products (Factory Direct Party)
  for (const t of THEMES) {
    for (const spec of THEMED_SPECS) {
      const title = spec.title(t.name);
      await upsertProduct("fdp-" + t.slug + "-" + spec.cat, {
        merchantId: fdp.id,
        title,
        description: spec.desc(t.name),
        price: spec.price,
        compareAt: spec.compareAt,
        pack: spec.pack,
        categoryId: catMap.get(spec.cat)!,
        themeTags: t.tags,
        colorTags: [],
        productUrl: "https://factorydirectparty.com/products/" + t.slug + "-" + spec.cat,
      });
    }
    // Anchor kit
    const kit = kitSpec(t);
    await upsertProduct("fdp-" + t.slug + "-kit", {
      merchantId: fdp.id,
      title: kit.title(t.name),
      description: kit.desc(t.name),
      price: kit.price,
      compareAt: kit.compareAt,
      pack: kit.pack,
      categoryId: catMap.get("decorations")!,
      themeTags: t.tags,
      colorTags: [],
      productUrl: "https://factorydirectparty.com/products/" + t.slug + "-party-kit",
    });
  }

  // Generic filler products (Factory Direct Party)
  const colorVariants = ["red", "blue", "green", "pink", "yellow", "purple"];
  for (const spec of GENERIC_SPECS) {
    for (const color of colorVariants) {
      const title = color.charAt(0).toUpperCase() + color.slice(1) + " " + spec.title("").trim();
      await upsertProduct("fdp-generic-" + spec.cat + "-" + color, {
        merchantId: fdp.id,
        title,
        description: spec.desc(""),
        price: spec.price,
        pack: spec.pack,
        categoryId: catMap.get(spec.cat)!,
        themeTags: [],
        colorTags: [color],
        productUrl: "https://factorydirectparty.com/products/" + spec.cat + "-" + color,
      });
    }
  }

  // A few Oriental Trading novelty/favor/craft products (theme-neutral + craft)
  const otSpecs: Spec[] = [
    { cat: "favors", title: () => "DIY Craft Favor Kit | 24 Pack", price: 9.99, pack: 24, desc: () => "Build-your-own craft favor kit, 24 per pack." },
    { cat: "decorations", title: () => "Confetti Table Scatter | 2 oz", price: 2.49, pack: 1, desc: () => "Festive confetti scatter for table decor." },
    { cat: "favors", title: () => "Sticker Roll Party Favors | 100 Count", price: 4.99, pack: 100, desc: () => "Thick sticker roll, 100 count — split across favor bags." },
    { cat: "cake", title: () => "Number Birthday Candles Set", price: 3.99, pack: 1, desc: () => "Numeric birthday candle set for the cake." },
  ];
  for (const s of otSpecs) {
    await upsertProduct("ot-" + s.cat + "-1", {
      merchantId: "merchant-ot",
      title: s.title(""),
      description: s.desc(""),
      price: s.price,
      pack: s.pack,
      categoryId: catMap.get(s.cat)!,
      themeTags: [],
      colorTags: [],
      productUrl: "https://orientaltrading.com/products/" + s.cat,
    });
  }

  // Seed articles (SEO) — see seed-articles
  const { seedArticles } = await import("./seed-articles");
  await seedArticles(prisma, site.id);

  // Demo host account for easy login (password: partyplan)
  const bcrypt = (await import("bcryptjs")).default;
  const existing = await prisma.user.findUnique({ where: { email: "host@example.com" } });
  if (!existing) {
    await prisma.user.create({
      data: { email: "host@example.com", name: "Demo Host", role: "HOST", password: await bcrypt.hash("partyplan", 10) },
    });
  }
  const adminExisting = await prisma.user.findUnique({ where: { email: "admin@example.com" } });
  if (!adminExisting) {
    await prisma.user.create({
      data: { email: "admin@example.com", name: "Demo Admin", role: "ADMIN", password: await bcrypt.hash("partyplan", 10) },
    });
  }

  console.log("Seeded site, merchants, categories, themes, " + count + " products, articles, and demo user.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
