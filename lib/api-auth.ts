import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getTokenFromRequest, verifyJwt } from "@/lib/auth";
import { normEmail } from "@/lib/formatters";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  active: boolean;
  emailVerifiedAt: Date | null;
  lastSeenReleaseAt: Date | null;
};

type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; status: 401 | 403; message: string };

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const payload = await verifyJwt(token);
  if (!payload) return null;

  const userId = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const email = typeof payload.email === "string" ? normEmail(payload.email) : "";

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          emailVerifiedAt: true,
          lastSeenReleaseAt: true,
        },
      })
    : email
      ? await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            active: true,
            emailVerifiedAt: true,
            lastSeenReleaseAt: true,
          },
        })
      : null;

  if (!user?.active || !user.emailVerifiedAt) return null;

  return {
    id: user.id,
    email: normEmail(user.email),
    name: user.name,
    role: user.role === "admin" ? "admin" : "user",
    active: user.active,
    emailVerifiedAt: user.emailVerifiedAt,
    lastSeenReleaseAt: user.lastSeenReleaseAt,
  };
}

export async function requireUser(req: NextRequest): Promise<AuthResult> {
  const user = await getSessionUser(req);
  if (!user) return { ok: false, status: 401, message: "Não autenticado" };
  return { ok: true, user };
}

export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;
  if (auth.user.role !== "admin") return { ok: false, status: 403, message: "Sem permissão" };
  return auth;
}
