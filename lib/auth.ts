import "server-only";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Role } from "@/lib/types";

export const SESSION_COOKIE = "pp_session";
const SESSION_TTL_DAYS = 30;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  try {
    return await bcrypt.compare(pw, hash);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, token, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => null);
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionToken() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    }
    return null;
  }
  return session.user;
}

export async function requireUser(role?: Role) {
  const u = await getCurrentUser();
  if (!u) {
    const { redirect } = await import("next/navigation");
    redirect("/login?next=" + encodeURIComponent(await currentPath()));
  }
  if (u && role && u.role !== role) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }
  return u as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}

async function currentPath() {
  try {
    const h = await headers();
    return h.get("x-invoke-path") || h.get("referer") || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

// Promote a user to ADMIN if their email is in the ADMIN_EMAILS allowlist.
export function isAdminEmail(email: string) {
  const allow = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}

// Anonymous browser key for guest dedupe (best-effort, privacy-preserving).
export async function getBrowserKey() {
  try {
    const h = await headers();
    const ua = h.get("user-agent") || "";
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(ua + ip + env.AUTH_SECRET).digest("hex").slice(0, 24);
  } catch {
    return null;
  }
}
