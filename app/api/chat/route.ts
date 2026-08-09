import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { generatePlan } from "@/lib/ai/recommend";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/affiliate";
import {
  advance,
  buildResultTurn,
  interpretFreeText,
  type ChatTheme,
  type ConversationState,
} from "@/lib/planner/conversation";
import { isAIConfigured } from "@/lib/ai/client";
import { interpretMessageWithModel } from "@/lib/planner/model-interpreter";
import type { ModelInterpretation } from "@/lib/planner/model-interpreter-core";
import type { PlanInput, LocationType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const StateSchema = z.object({
  step: z
    .enum(["intro", "theme", "guests", "budget", "age", "location", "planning", "result"])
    .default("intro"),
  themeSlug: z.string().max(80).optional(),
  themeName: z.string().max(80).optional(),
  themeTags: z.array(z.string().max(80)).max(8).optional(),
  guestCount: z.number().int().min(1).max(500).optional(),
  budgetTotal: z.number().min(10).max(5000).optional(),
  childAge: z.number().int().min(0).max(18).optional(),
  locationType: z.enum(["HOME", "VENUE", "OUTDOOR", "PARK"]).optional(),
});

const BodySchema = z.object({
  state: StateSchema.passthrough().default({ step: "intro" }),
  answer: z.string().max(120).nullable().default(null),
  message: z.string().trim().min(1).max(500).optional(),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 422 });
  }

  // Rate-limit conversation turns loosely; the heavy plan generation is also
  // capped below so the model can't be abused.
  const ip = getClientIp(req.headers) || "anon";
  const rl = rateLimit({ key: "chat:ip:" + ip, limit: 60, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many messages. Please slow down a little. 🌷" },
      { status: 429, headers: { "retry-after": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const state = parsed.data.state as ConversationState;
  let answer = parsed.data.answer;

  const themes = await prisma.theme.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true, emoji: true },
  });
  const chatThemes: ChatTheme[] = themes.map((t) => ({
    slug: t.slug,
    name: t.name,
    emoji: t.emoji ?? "🎉",
  }));

  const typedMessage = parsed.data.message;
  let modelInterpretation: ModelInterpretation | null = null;
  if (typedMessage) {
    if (isAIConfigured()) {
      try {
        modelInterpretation = await interpretMessageWithModel(state, typedMessage, chatThemes);
      } catch (error) {
        console.warn("[chat] model interpretation failed, using local fallback:", (error as Error).message);
      }
    }
    const fallbackAnswer = interpretFreeText(state, typedMessage, chatThemes);
    answer = modelInterpretation?.relevant ? modelInterpretation.answer : fallbackAnswer;
  }

  const result = advance(state, answer, chatThemes, modelInterpretation ?? undefined);

  if (typedMessage && answer === null && state.step !== "planning") {
    result.ignored = true;
  }

  // If the flow has collected everything, run the (validated, hallucination-
  // proof) planner and append the celebratory result turn.
  if (result.readyForPlan) {
    if (!state.themeSlug || !state.guestCount || !state.budgetTotal) {
      return Response.json({
        state: { ...result.state, step: "theme" },
        turns: [
          {
            text: "Hmm, I'm missing a detail. Let's restart cleanly — what theme are we doing? 🎨",
            quickReplies: chatThemes.map((t) => ({ label: t.name, value: t.slug, emoji: t.emoji })),
          },
        ],
      });
    }

    // Stricter cap on actual AI generations.
    const planRl = rateLimit({ key: "plan:ip:" + ip, limit: 10, windowMs: 60 * 60 * 1000 });
    if (!planRl.ok) {
      return Response.json({
        state: { ...result.state, step: "result" },
        turns: [
          {
            text: "You've generated a lot of plans this hour! 🌟 Give it a little break and try again soon.",
            quickReplies: [{ label: "↩️ Start over", value: "restart" }],
          },
        ],
      });
    }

    const site = await prisma.site.findFirst({ where: { active: true } });
    if (!site) {
      return Response.json({ error: "No active site configured" }, { status: 500 });
    }
    const themeRow = await prisma.theme.findUnique({ where: { slug: state.themeSlug } });

    const input: PlanInput = {
      siteSlug: site.slug,
      themeSlug: state.themeSlug,
      themeTags: state.themeTags,
      childAge: state.childAge,
      guestCount: state.guestCount,
      budgetTotal: state.budgetTotal,
      locationType: (state.locationType as LocationType) || undefined,
    };

    let draftId: string | undefined;
    try {
      const gen = await generatePlan(input);

      // Persist an anonymous draft so the "save & share" action can publish it.
      const event = await prisma.event.create({
        data: {
          siteId: site.id,
          themeId: themeRow?.id,
          token: nanoid(16),
          childAge: state.childAge ?? null,
          guestCount: state.guestCount,
          budgetTotal: state.budgetTotal,
          locationType: state.locationType ?? null,
          status: "DRAFT",
        },
      });
      await prisma.recommendationSet.create({
        data: {
          eventId: event.id,
          inputHash: gen.inputHash,
          output: gen.output as object,
          model: gen.model ?? null,
          tokensIn: gen.tokensIn ?? null,
          tokensOut: gen.tokensOut ?? null,
          latencyMs: gen.latencyMs,
          source: gen.source,
        },
      });
      draftId = event.id;

      result.turns.push(buildResultTurn(gen.plan, result.state, draftId));
      result.state.step = "result";
    } catch (e) {
      const msg = (e as Error).message || "I couldn't build that plan.";
      result.turns.push({
        text: `Oops — ${msg} Want to try a different theme or budget? 🤔`,
        quickReplies: [{ label: "↩️ Start over", value: "restart" }],
      });
      result.state.step = "result";
    }
  }

  return Response.json({
    state: result.state,
    turns: result.turns,
    ignored: result.ignored,
  });
}
