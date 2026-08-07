import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";

// OmniRoute (OpenAI-compatible) client. Server-only; key never exposed to the
// browser. Wrapped behind the RecommendationProvider interface so the provider
// can be swapped without touching business logic.
export function createAIClient() {
  // OmniRoute always returns SSE, so all calls use stream:true and accumulate.
  return new OpenAI({
    baseURL: env.OMNI_BASE_URL,
    apiKey: env.OMNI_API_KEY || "missing-key",
    maxRetries: 1,
    timeout: 45_000,
  });
}

export function aiModel() {
  return env.OMNI_MODEL;
}

export function isAIConfigured() {
  return env.OMNI_API_KEY.length > 8 && env.OMNI_BASE_URL.length > 0;
}
