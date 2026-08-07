import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { generatePlanStreaming, hydrateFromDB } from "@/lib/ai/recommend";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/affiliate";
import type { PlanInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const InputSchema = z.object({
  themeSlug: z.string().min(1).max(80),
  guestCount: z.number().int().min(1).max(500),
  budgetTotal: z.number().min(10).max(5000),
  childAge: z.number().int().min(0).max(18).optional(),
  childName: z.string().max(60).optional(),
  partyDate: z.string().max(40).optional(),
  locationType: z.string().max(20).optional(),
  siteSlug: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  // Rate limit: 10 generations per IP per hour.
  const ip = getClientIp(req.headers) || "anon";
  const rl = rateLimit({ key: "rec:ip:" + ip, limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many plans generated. Please try again later." },
      { status: 429, headers: { "retry-after": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const data = parsed.data;
  const theme = await prisma.theme.findUnique({ where: { slug: data.themeSlug } });
  const site = await prisma.site.findFirst({ where: { active: true } });
  if (!site) {
    return Response.json({ error: "No active site configured" }, { status: 500 });
  }

  const input: PlanInput = {
    siteSlug: data.siteSlug || site.slug,
    themeSlug: data.themeSlug,
    childName: data.childName,
    childAge: data.childAge,
    guestCount: data.guestCount,
    budgetTotal: data.budgetTotal,
    partyDate: data.partyDate,
    locationType: (data.locationType as PlanInput["locationType"]) || undefined,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode("event: " + event + "\n data: " + JSON.stringify(payload) + "\n\n"));
      };
      try {
        send("status", { message: "Analyzing your theme and guest count…" });
        const result = await generatePlanStreaming(input, (delta, full) => {
          send("token", { delta, full });
        });
        const plan = await hydrateFromDB(result.output, input.budgetTotal, result.source, result.model);

        // Persist an anonymous draft event so results can be revisited at /plan/[draftId].
        const event = await prisma.event.create({
          data: {
            siteId: site.id,
            themeId: theme?.id,
            token: nanoid(16),
            childName: data.childName || null,
            childAge: data.childAge ?? null,
            guestCount: data.guestCount,
            budgetTotal: data.budgetTotal,
            partyDate: data.partyDate ? new Date(data.partyDate) : null,
            locationType: data.locationType || null,
            status: "DRAFT",
          },
        });
        await prisma.recommendationSet.create({
          data: {
            eventId: event.id,
            inputHash: result.inputHash,
            output: result.output as object,
            model: result.model ?? null,
            tokensIn: result.tokensIn ?? null,
            tokensOut: result.tokensOut ?? null,
            latencyMs: result.latencyMs,
            source: result.source,
          },
        });

        send("done", {
          draftId: event.id,
          draftToken: event.token,
          plan,
          source: result.source,
          model: result.model,
          latencyMs: result.latencyMs,
          dropped: result.dropped,
          input,
        });
      } catch (e) {
        send("error", { message: (e as Error).message || "Failed to generate plan" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
