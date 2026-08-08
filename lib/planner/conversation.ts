import type { HydratedPlan, LocationType } from "@/lib/types";

// Guided party-planning conversation. There is intentionally NO free-text
// input: the assistant asks one question at a time and the user only ever
// responds by tapping a provided option chip (a QuickReply value). Every
// answer is validated against the allow-list for the current step, so any
// off-topic / unexpected value is simply ignored and the assistant gently
// re-prompts on topic — the "moderation" behaviour required by the product.

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
  guestCount?: number;
  budgetTotal?: number;
  childAge?: number;
  locationType?: LocationType;
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

const LOCATION_LABEL: Record<string, string> = {
  HOME: "at home",
  VENUE: "at an indoor venue",
  OUTDOOR: "outdoors",
  PARK: "at a park",
};

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
            text: "Love it! 🎈 First up — what vibe are we going for? Pick a theme and I'll build everything around it.",
            quickReplies: themeReplies(themes),
          };
          state.step = "theme";
          return { state, turns: [turn], ...ignoredBase };
        }
        // answer === null: initial greeting, wait for the user to start.
        const turn: AssistantTurn = {
          text: "Hey there! 🎉 I'm Pippa, your AI party-planning sidekick. I'll ask a few quick questions, then build you a complete, budget-smart shopping plan from real party supplies — no typing needed, just tap the options below. Ready?",
          quickReplies: [{ label: "Let's go! 🚀", value: "start" }],
        };
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("I'm here to plan your party! Tap below to begin. 🎈", [{ label: "Let's go! 🚀", value: "start" }])],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "theme": {
      const slugs = new Set(themes.map((t) => t.slug));
      if (answer && slugs.has(answer)) {
        const theme = themes.find((t) => t.slug === answer)!;
        state.themeSlug = theme.slug;
        state.themeName = theme.name;
        const turn: AssistantTurn = {
          text: `Ooh, ${theme.name}! Great pick ${theme.emoji} Now — roughly how many guests are coming? (Kids + grown-ups count.)`,
          quickReplies: GUEST_OPTIONS,
        };
        state.step = "guests";
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("Let's keep it to party themes — pick one below and we'll roll! 🎨", themeReplies(themes))],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "guests": {
      const opts = allowed(GUEST_OPTIONS);
      if (answer && opts.has(answer)) {
        state.guestCount = Number(answer);
        const turn: AssistantTurn = {
          text: `Got it — about ${state.guestCount} guests. 💜 What's your budget for supplies? (Decor, tableware, favors — the works.)`,
          quickReplies: BUDGET_OPTIONS,
        };
        state.step = "budget";
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("Just tap a guest-count option below — that's all I need to size everything right. 👫", GUEST_OPTIONS)],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "budget": {
      const opts = allowed(BUDGET_OPTIONS);
      if (answer && opts.has(answer)) {
        state.budgetTotal = Number(answer);
        const turn: AssistantTurn = {
          text: `Nice — $${state.budgetTotal} is very workable. 💪 How old is the birthday kid? (This helps me pick age-appropriate stuff.)`,
          quickReplies: AGE_OPTIONS,
        };
        state.step = "age";
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("Tap a budget range below and I'll make every dollar count. 💵", BUDGET_OPTIONS)],
        ignored: true,
        readyForPlan: false,
      };
    }

    case "age": {
      const opts = allowed(AGE_OPTIONS);
      if (answer && opts.has(answer)) {
        state.childAge = answer === "skip" ? undefined : Number(answer);
        const turn: AssistantTurn = {
          text: "Perfect. 🎂 Last thing — where's the party happening?",
          quickReplies: LOCATION_OPTIONS,
        };
        state.step = "location";
        return { state, turns: [turn], ...ignoredBase };
      }
      return {
        state,
        turns: [reAsk("Just pick an age range (or skip) — tap below. 🧒", AGE_OPTIONS)],
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
        turns: [reAsk("Tap a location option below — or 'not sure yet' is totally fine. 🏠", LOCATION_OPTIONS)],
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
