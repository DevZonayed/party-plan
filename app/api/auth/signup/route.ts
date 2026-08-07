import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSession, isAdminEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(6).max(100),
  name: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter a valid email and a password of 6+ characters." }, { status: 422 });
  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return Response.json({ error: "An account with that email already exists." }, { status: 409 });
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name: name || null, password: await hashPassword(password), role: isAdminEmail(email) ? "ADMIN" : "HOST" },
  });
  await createSession(user.id);
  return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
