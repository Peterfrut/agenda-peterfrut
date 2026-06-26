import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PASSWORD_RULES_MESSAGE, validatePassword } from "@/lib/formatters";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, retryAfterResponse } from "@/lib/security";
import { getUrlTokenLookupValues } from "@/lib/token-security";
import { createAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`reset-password:ip:${ip}`, 10, 60_000);
    if (!rl.ok) return retryAfterResponse("Muitas tentativas.", rl.resetAt);

    const body = await req.json().catch(() => ({}));
    const tokenLookup = getUrlTokenLookupValues(body?.token);
    const password = String(body?.password ?? "");

    if (!tokenLookup || !password) {
      return NextResponse.json(
        { ok: false, message: "Token e senha sao obrigatorios." },
        { status: 400 }
      );
    }

    if (!validatePassword(password)) {
      return NextResponse.json(
        { ok: false, message: PASSWORD_RULES_MESSAGE },
        { status: 400 }
      );
    }

    const prt = await prisma.passwordResetToken.findFirst({
      where: {
        OR: [{ token: tokenLookup.hashed }, { token: tokenLookup.raw }],
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      select: { id: true, userId: true, user: { select: { id: true, name: true, email: true, active: true } } },
    });

    if (!prt || !prt.user.active) {
      return NextResponse.json(
        { ok: false, message: "Token invalido ou expirado." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: prt.userId },
        data: { password: hash },
      }),
      prisma.passwordResetToken.update({
        where: { id: prt.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await createAuditLog(req, { id: prt.user.id, name: prt.user.name, email: prt.user.email }, {
      action: "auth.password_reset_completed",
      category: "auth",
      severity: "warning",
      targetType: "user",
      targetId: prt.user.id,
      targetLabel: prt.user.email,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[RESET-PASSWORD] error:", e);
    return NextResponse.json(
      { ok: false, message: "Erro interno ao redefinir senha." },
      { status: 500 }
    );
  }
}
