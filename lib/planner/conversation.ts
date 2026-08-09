import type { HydratedPlan, LocationType } from "@/lib/types";

// Guided party-planning conversation. Quick replies are convenient suggestions,
// while free-text messages are interpreted into canonical values before this
// state machine advances. Off-topic or unusable answers stay on the current
// question and receive a focused re-prompt.

export type ChatStep =
  | "intro"
  | "theme"
  | "guests"
  | "budget"
  | "age"
  | "location"
  | "planning"
  | "result";

export interface ChatTheme {
  slug: string;
  name: string;
  emoji: string;
}

export interface ConversationState {
  step: ChatStep;
  themeSlug?: string;
  themeName?: string;
  themeTags?: string[];
  guestCount?: number;
  budgetTotal?: number;
  childAge?: number;
  locationType?: LocationType;
}

export interface InterpretedAnswer {
  answer: string | null;
  themeName?: string | null;
  themeTags?: string[];
  reply?: string | null;
}

export interface QuickReply {
  label: string;
  value: string;
  emoji?: string;
}

export interface AssistantTurn {
  text: string;
  quickReplies?: QuickReply[];
  /** Present on the final turn, rendered as product cards in the chat. */
  plan?: HydratedPlan;
  draftId?: string;
}

export interface AdvanceResult {
  state: ConversationState;
  turns: AssistantTurn[];
  /** True when the answer was off-topic/invalid and was ignored. */
  ignored: boolean;
  /** True when enough info is collected and the caller should run the planner. */
  readyForPlan: boolean;
}

// Fixed option sets. Each `value` is the canonical answer the server accepts.
export const GUEST_OPTIONS: QuickReply[] = [
  { label: "Up to 10", value: "10", emoji: "👫" },
  { label: "10–20", value: "15", emoji: "👨‍👩‍👧" },
  { label: "20–30", value: "25", emoji: "🎉" },
  { label: "30–50", value: "40", emoji: "🎊" },
  { label: "50+", value: "60", emoji: "🏆" },
];

export const BUDGET_OPTIONS: QuickReply[] = [
  { label: "$50–100", value: "100", emoji: "💵" },
  { label: "$100–200", value: "200", emoji: "💵" },
  { label: "$200–350", value: "350", emoji: "💸" },
  { label: "$350–500", value: "500", emoji: "💳" },
  { label: "$500+", value: "600", emoji: "💎" },
];

export const AGE_OPTIONS: QuickReply[] = [
  { label: "Toddler · 1–3", value: "3", emoji: "🍼" },
  { label: "Little kid · 4–7", value: "6", emoji: "🧒" },
  { label: "Big kid · 8–12", value: "10", emoji: "🧑" },
  { label: "Teen · 13+", value: "14", emoji: "🎤" },
  { label: "Prefer to skip", value: "skip", emoji: "🤫" },
];

export const LOCATION_OPTIONS: QuickReply[] = [
  { label: "At home", value: "HOME", emoji: "🏠" },
  { label: "Indoor venue", value: "VENUE", emoji: "🏢" },
  { label: "Outdoors / backyard", value: "OUTDOOR", emoji: "🌳" },
  { label: "At a park", value: "PARK", emoji: "🏕️" },
  { label: "Not sure yet", value: "UNSURE", emoji: "🤷" },
];

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

function normalized(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9$+\-.'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNumber(value: string): number | null {
  const numeric = value.match(/\b\d+(?:\.\d+)?\b/);
  if (numeric) return Number(numeric[0]);
  for (const [word, number] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(value)) return number;
  }
  return null;
}

function themeAliases(theme: ChatTheme): string[] {
  const cleanName = normalized(theme.name);
  const cleanSlug = normalized(theme.slug.replace(/[-_]/g, " "));
  const aliases = new Set([cleanName, cleanSlug]);
  if (cleanName.includes("spider man")) aliases.add("spiderman");
  if (cleanName.includes("dinosaur")) aliases.add("dino");
  if (cleanName.includes("enchanted unicorn")) aliases.add("unicorn");
  if (cleanName.includes("disney princess")) aliases.add("princess");
  if (cleanName.includes("space explorer")) aliases.add("space");
  return [...aliases].filter(Boolean);
}

/** Convert a typed message into the canonical answer expected by `advance`. */
export function interpretFreeText(
  state: ConversationState,
  message: string,
  themes: ChatTheme[],
): string | null {
  const text = normalized(message).slice(0, 500);
  if (!text) return null;

  switch (state.step) {
    case "intro":
      return /\b(yes|yeah|yep|ready|start|begin|go|plan|help|hi|hello|hey)\b/.test(text) ? "start" : null;

    case "theme": {
      for (const theme of themes) {
        if (themeAliases(theme).some((alias) => text === alias || text.includes(alias))) return theme.slug;
      }
      return null;
    }

    case "guests": {
      const count = firstNumber(text);
      return count !== null && Number.isInteger(count) && count >= 1 && count <= 500 ? String(count) : null;
    }

    case "budget": {
      const amount = firstNumber(text);
      return amount !== null && amount >= 10 && amount <= 5000 ? String(Math.round(amount * 100) / 100) : null;
    }

    case "age": {
      if (/\b(skip|prefer not|rather not|private|don't know|do not know|not sure)\b/.test(text)) return "skip";
      const age = firstNumber(text);
      return age !== null && Number.isInteger(age) && age >= 0 && age <= 18 ? String(age) : null;
    }

    case "location":
      if (/\b(park|playground)\b/.test(text)) return "PARK";
      if (/\b(backyard|garden|outdoor|outside|patio|yard)\b/.test(text)) return "OUTDOOR";
      if (/\b(venue|hall|restaurant|indoor|community center|party room)\b/.test(text)) return "VENUE";
      if (/\b(home|house|apartment|our place|my place)\b/.test(text)) return "HOME";
      if (/\b(unsure|not sure|don't know|do not know|undecided)\b/.test(text)) return "UNSURE";
      return null;

    case "result":
      if (/\b(start over|restart|new party|different party)\b/.test(text)) return "restart";
      if (/\b(again|another plan|regenerate|redo|try again)\b/.test(text)) return "regenerate";
      return null;

    case "planning":
    default:
      return null;
  }
}

function allowed(values: QuickReply[]): Set<string> {
  return new Set(values.map((o) => o.value));
}

function themeReplies(themes: ChatTheme[]): QuickReply[] {
  return themes.map((t) => ({ label: t.name, value: t.slug, emoji: t.emoji }));
}

function reAsk(text: string, options: QuickReply[]): AssistantTurn {
  return { text, quickReplies: options };
}

/**
 * Advance the conversation by one user answer.
 * `themes` is only needed to validate/render the theme step.
 */
export function advance(
  prev: ConversationState,
  answer: string | null,
  themes: ChatTheme[],
  interpreted?: InterpretedAnswer,
): AdvanceResult {
  const state: ConversationState = { ...prev };
  const ignoredBase: Pick<AdvanceResult, "ignored" | "readyForPlan"> = {
    ignored: false,
    readyForPlan: false,
  };

  switch (state.step) {
    case "intro": {
      if (answer === null || answer === "start") {
        if (answer === "start") {
          const turn: AssistantTurn = {
            text: "Love it! 🎈 First up — what vibe are we going for? Tell me the theme, or pick a suggestion below.",
            quickReplies: themeReplies(themes),
          };
          state.step = "theme";
          return { state, turns: [turn], ...ignoredBase };
        }
        // answer === null: initial greeting, wait for the user to start.
        const turn: AssistantTurn = {
          text: "Hey there! 🎉 I'm Pippa, your AI party-planning sidekick. Tell me about the celebration in your own words, or use the quick suggestions. I'll ask a few focused questions and build a complete, budget-smart shopping plan from real party supplies. Ready?",
          quickReplies: [{ label: "Let's go! 🚀", value: "start" }],
        };
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("I'm here to plan your party! Say hello or use the button below to begin. 🎈", [{ label: "Let's go! 🚀", value: "start" }])],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "theme": {
      const slugs = new Set(themes.map((t) => t.slug));
      const theme = answer ? themes.find((t) => t.slug === answer) : undefined;
      const customThemeName = interpreted?.themeName?.trim();
      if (answer && (slugs.has(answer) || customThemeName)) {
        state.themeSlug = answer;
        state.themeName = theme?.name ?? customThemeName!;
        state.themeTags = theme ? undefined : interpreted?.themeTags;
        const themeEmoji = theme ? theme.emoji : "🎨";
        const acknowledgement = interpreted?.reply?.trim();
        const themeGreeting = acknowledgement || "Ooh, " + state.themeName + "! Great pick " + themeEmoji;
        const turn: AssistantTurn = {
          text: themeGreeting + " Now — roughly how many guests are coming? (Kids + grown-ups count.)",
          quickReplies: GUEST_OPTIONS,
        };
        state.step = "guests";
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("I can help with the party theme here. Tell me one of the available themes, or pick a suggestion below. 🎨", themeReplies(themes))],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "guests": {
      const guestCount = answer ? Number(answer) : Number.NaN;
      if (Number.isInteger(guestCount) && guestCount >= 1 && guestCount <= 500) {
        state.guestCount = guestCount;
        const turn: AssistantTurn = {
          text: `Got it — about ${state.guestCount} guests. 💜 What's your budget for supplies? (Decor, tableware, favors — the works.)`,
          quickReplies: BUDGET_OPTIONS,
        };
        state.step = "budget";
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("Tell me roughly how many guests are coming, or use a range below. 👫", GUEST_OPTIONS)],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "budget": {
      const budgetTotal = answer ? Number(answer) : Number.NaN;
      if (Number.isFinite(budgetTotal) && budgetTotal >= 10 && budgetTotal <= 5000) {
        state.budgetTotal = budgetTotal;
        const turn: AssistantTurn = {
          text: `Nice — $${state.budgetTotal} is very workable. 💪 How old is the birthday kid? (This helps me pick age-appropriate stuff.)`,
          quickReplies: AGE_OPTIONS,
        };
        state.step = "age";
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("Tell me your supplies budget in dollars, or use a range below. 💵", BUDGET_OPTIONS)],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "age": {
      const age = answer ? Number(answer) : Number.NaN;
      if (answer === "skip" || (Number.isInteger(age) && age >= 0 && age <= 18)) {
        state.childAge = answer === "skip" ? undefined : age;
        const turn: AssistantTurn = {
          text: "Perfect. 🎂 Last thing — where's the party happening?",
          quickReplies: LOCATION_OPTIONS,
        };
        state.step = "location";
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("Tell me the birthday kid's age, or choose skip if you'd rather not share. 🧒", AGE_OPTIONS)],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "location": {
      const opts = allowed(LOCATION_OPTIONS);
      if (answer && opts.has(answer)) {
        const loc: LocationType = answer === "UNSURE" ? "HOME" : (answer as LocationType);
        state.locationType = loc;
        state.step = "planning";
        // No text turn here: the caller shows a "building your plan" indicator
        // while the AI runs (~seconds), then appends the celebratory result.
        return { state, turns: [], ...ignoredBase, readyForPlan: true };
      }
      return {
        state,
        turns: [reAsk("Tell me where the party will happen, or use a suggestion below. 'Not sure yet' is fine too. 🏠", LOCATION_OPTIONS)],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "result": {
      // Post-plan actions handled by the chat UI's action buttons, but a few
      // chip-driven flows are supported here for completeness.
      if (answer === "restart") {
        const fresh: ConversationState = { step: "intro" };
        const turn: AssistantTurn = {
          text: "Fresh start! 🎈 What theme shall we do this time?",
          quickReplies: themeReplies(themes),
        };
        fresh.step = "theme";
        return { state: fresh, turns: [turn], ignored: false, readyForPlan: false };
      }
      if (answer === "regenerate") {
        state.step = "planning";
        return { state, turns: [], ignored: false, readyForPlan: true };
      }
      return {
        state,
        turns: [reAsk("Want to plan again or start over? Tap below 👇", [
          { label: "🔁 Plan it again", value: "regenerate" },
          { label: "↩️ Start over", value: "restart" },
        ])],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "planning":
    default: {
      // While planning we accept nothing; any stray answer is ignored.
      return {
        state,
        turns: [{ text: "Still building your plan — one sec! ✨" }],
        ignored: true,
        readyForPlan: false,
      };
    }
  }
}

/** Build the celebratory result turn that carries the product plan. */
export function buildResultTurn(
  plan: HydratedPlan,
  state: ConversationState,
  draftId: string,
): AssistantTurn {
  const overUnder = plan.withinBudget ? "right on budget" : "just a touch over";
  const itemTotal = plan.categories.reduce((s, c) => s + c.items.length, 0);
  const text =
    `Here's your ${state.themeName ?? ""} party plan! 🎉 I picked ${itemTotal} real products ` +
    `across ${plan.categories.length} categories, landing at $${plan.total.toFixed(2)} of your $${plan.budgetTotal} budget ` +
    `(${overUnder}). Tap any item to shop it, or save it as a shareable event page your guests can RSVP to. ✅`;
  return {
    text,
    plan,
    draftId,
    quickReplies: [
      { label: "🔁 Plan it again", value: "regenerate" },
      { label: "↩️ Start over", value: "restart" },
    ],
  };
}

export const RESULT_ACTIONS = {
  regenerate: "regenerate",
  restart: "restart",
} as const;
