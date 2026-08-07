// Visual heuristics for product/theme placeholder art (used until real
// merchant images are ingested via the affiliate product feed).
export const CATEGORY_EMOJI: Record<string, string> = {
  tableware: "🍽️",
  plates: "🍽️",
  cups: "🥤",
  napkins: "🧻",
  tablecloths: "🗝️",
  balloons: "🎈",
  decorations: "🎊",
  favors: "🎁",
  cake: "🎂",
  invitations: "✉️",
  other: "🎉",
};

export const THEME_EMOJI: Record<string, string> = {
  bluey: "🐶",
  spiderman: "🕷️",
  unicorn: "🦄",
  princess: "👸",
  dinosaur: "🦖",
  space: "🚀",
  pawpatrol: "🐕",
  babyshark: "🦈",
};

export function categoryEmoji(slug: string) {
  return CATEGORY_EMOJI[slug?.toLowerCase()] ?? "🎉";
}

export function themeEmoji(slug: string) {
  return THEME_EMOJI[slug?.toLowerCase()] ?? "🎉";
}
