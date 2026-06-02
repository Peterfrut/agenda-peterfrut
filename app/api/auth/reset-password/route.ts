import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PASSWORD_RULES_MESSAGE, normalizeToken, validatePassword } from "@/lib/formatters";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, retryAfterResponse } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`reset-password:ip:${ip}`, 10, 60_000);
    if (!rl.ok) return retryAfterResponse("Muitas tentativas.", rl.resetAt);

    const body = await req.json().catch(() => ({}));
    const token = normalizeToken(body?.token);
    const password = String(body?.password ?? "");
    const prt = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      select: { id: true, userId: true, user: { select: { active: true } } },
    });

    if (!prt?.user.active) {
      return NextResponse.json(
        { ok: false, message: "Token inválido ou expirado." },
        { status: 400 }
      );
    }

    if (!token || !password) {
      return NextResponse.json(
        { ok: false, message: "Token e senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (!validatePassword(password)) {
      return NextResponse.json(
        { ok: false, message: PASSWORD_RULES_MESSAGE },
        { status: 400 }
      );
    }


    const hash = await bcrypt.hash(password, 10);

    // Troca senha e invalida token.
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[RESET-PASSWORD] error:", e);
    return NextResponse.json(
      { ok: false, message: "Erro interno ao redefinir senha." },
      { status: 500 }
    );
  }
}
