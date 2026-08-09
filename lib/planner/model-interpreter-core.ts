import type { ChatStep } from "./conversation";

export interface ModelInterpretation {
  relevant: boolean;
  answer: string | null;
  themeName: string | null;
  themeTags: string[];
  reply: string | null;
}

export function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("The model did not return a JSON object.");
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanTags(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const tags = values
    .filter((value): value is string => typeof value === "string")
    .map(slugify)
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 8);
}

function invalid(): ModelInterpretation {
  return { relevant: false, answer: null, themeName: null, themeTags: [], reply: null };
}

export function parseModelInterpretation(value: unknown, step: ChatStep): ModelInterpretation {
  if (!value || typeof value !== "object") return invalid();
  const raw = value as Record<string, unknown>;
  if (raw.relevant !== true || typeof raw.answer !== "string") return invalid();

  const reply = typeof raw.reply === "string" && raw.reply.trim() ? raw.reply.trim().slice(0, 240) : null;

  if (step === "theme") {
    const themeName = typeof raw.themeName === "string" ? raw.themeName.trim().slice(0, 80) : "";
    const answer = slugify(raw.answer);
    if (!answer || !themeName) return invalid();
    const themeTags = cleanTags(raw.themeTags);
    return { relevant: true, answer, themeName, themeTags: themeTags.slice(0, 8), reply };
  }

  const answer = raw.answer.trim();
  if (step === "intro") {
    return answer === "start" ? { relevant: true, answer, themeName: null, themeTags: [], reply } : invalid();
  }
  if (step === "guests") {
    const count = Number(answer);
    return Number.isInteger(count) && count >= 1 && count <= 500
      ? { relevant: true, answer: String(count), themeName: null, themeTags: [], reply }
      : invalid();
  }
  if (step === "budget") {
    const budget = Number(answer);
    return Number.isFinite(budget) && budget >= 10 && budget <= 5000
      ? { relevant: true, answer: String(Math.round(budget * 100) / 100), themeName: null, themeTags: [], reply }
      : invalid();
  }
  if (step === "age") {
    if (answer === "skip") return { relevant: true, answer, themeName: null, themeTags: [], reply };
    const age = Number(answer);
    return Number.isInteger(age) && age >= 0 && age <= 18
      ? { relevant: true, answer: String(age), themeName: null, themeTags: [], reply }
      : invalid();
  }
  if (step === "location") {
    return ["HOME", "VENUE", "OUTDOOR", "PARK", "UNSURE"].includes(answer)
      ? { relevant: true, answer, themeName: null, themeTags: [], reply }
      : invalid();
  }
  if (step === "result") {
    return ["restart", "regenerate"].includes(answer)
      ? { relevant: true, answer, themeName: null, themeTags: [], reply }
      : invalid();
  }
  return invalid();
}
