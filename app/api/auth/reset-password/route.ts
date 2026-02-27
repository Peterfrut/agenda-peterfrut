import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { normalizeToken } from "@/lib/formatters";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = normalizeToken(body?.token);
    const password = String(body?.password ?? "");
    const prt = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (!prt) {
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

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, message: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }


    const hash = await bcrypt.hash(password, 10);

    // Troca senha e invalida token (deletando)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: prt.userId },
        data: { password: hash },
      }),
      prisma.passwordResetToken.delete({
        where: { id: prt.id },
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
