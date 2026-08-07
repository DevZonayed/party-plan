import "server-only";

function required(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error("Missing required env var: " + name);
  }
  return v;
}

export const env = {
  get OMNI_BASE_URL() {
    return process.env.OMNI_BASE_URL ?? "https://omni.jonayed.me/v1";
  },
  get OMNI_API_KEY() {
    return process.env.OMNI_API_KEY ?? process.env.OMNIROUTE_API_KEY ?? "";
  },
  get OMNI_MODEL() {
    return process.env.OMNI_MODEL ?? "cc-sonnet";
  },
  get AUTH_SECRET() {
    return required("AUTH_SECRET", "dev-insecure-secret");
  },
  get APP_URL() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
  get DEFAULT_SITE() {
    return process.env.NEXT_PUBLIC_DEFAULT_SITE ?? "birthday";
  },
  get DATABASE_URL() {
    return process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  },
};

export const isProd = process.env.NODE_ENV === "production";
