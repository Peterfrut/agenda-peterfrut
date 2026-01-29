import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/password-reset-mail";

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);

    if (!email) {
      return NextResponse.json(
        { ok: false, message: "Informe o e-mail" },
        { status: 400 }
      );
    }

    // garante que a busca seja por lowercase
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    // Resposta genérica para não denunciar existência
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = randomBytes(32).toString("hex");

    // 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Invalida tokens antigos (sem usedAt) -> deleta os anteriores
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

    // ENVIA O E-MAIL
    await sendPasswordResetEmail({
      to: user.email,          // já vem do banco
      name: user.name,
      resetUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[FORGOT-PASSWORD] error:", e);
    return NextResponse.json(
      { ok: false, message: "Erro ao solicitar redefinição de senha" },
      { status: 500 }
    );
  }
}
