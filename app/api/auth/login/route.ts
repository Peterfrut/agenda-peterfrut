import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signJwt } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, retryAfterResponse } from "@/lib/security";
import { createAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rlIp = rateLimit(`login:ip:${ip}`, 8, 60_000);
  if (!rlIp.ok) {
    return retryAfterResponse("Muitas tentativas.", rlIp.resetAt);
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (email) {
    const rlEmail = rateLimit(`login:email:${email}`, 5, 60_000);
    if (!rlEmail.ok) {
      return retryAfterResponse("Muitas tentativas para este e-mail.", rlEmail.resetAt);
    }
  }

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "Email e senha sao obrigatorios" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      await createAuditLog(req, { email }, {
        action: "auth.login_failed",
        category: "auth",
        severity: "warning",
        targetType: "user",
        targetLabel: email,
        metadata: { reason: "user_not_found" },
      });

      return NextResponse.json(
        { ok: false, message: "Credenciais invalidas" },
        { status: 401 }
      );
    }

    if (!user.active) {
      await createAuditLog(req, { id: user.id, name: user.name, email: user.email }, {
        action: "auth.login_blocked",
        category: "auth",
        severity: "warning",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
        metadata: { reason: "inactive_user" },
      });

      return NextResponse.json(
        { ok: false, message: "Usuario inativo. Procure o TI." },
        { status: 403 }
      );
    }

    if (!user.emailVerifiedAt) {
      await createAuditLog(req, { id: user.id, name: user.name, email: user.email }, {
        action: "auth.login_blocked",
        category: "auth",
        severity: "warning",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
        metadata: { reason: "email_not_verified" },
      });

      return NextResponse.json(
        { ok: false, message: "Verifique seu e-mail primeiro." },
        { status: 403 }
      );
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await createAuditLog(req, { id: user.id, name: user.name, email: user.email }, {
        action: "auth.login_failed",
        category: "auth",
        severity: "warning",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
        metadata: { reason: "invalid_password" },
      });

      return NextResponse.json(
        { ok: false, message: "Credenciais invalidas" },
        { status: 401 }
      );
    }

    const token = await signJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax",
    });

    await createAuditLog(req, { id: user.id, name: user.name, email: user.email }, {
      action: "auth.login_success",
      category: "auth",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });

    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, message: "Erro interno no login" },
      { status: 500 }
    );
  }
}
