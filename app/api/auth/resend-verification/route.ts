import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendEmailVerification } from "@/lib/verify-email-mail";
import { normEmail } from "@/lib/formatters";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normEmail(body?.email);

    if (!email) {
      return NextResponse.json({ ok: false, message: "Informe o e-mail." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });

    // resposta genérica para não vazar existência
    if (!user) return NextResponse.json({ ok: true });

    // se já verificou, não precisa reenviar
    if (user.emailVerifiedAt) return NextResponse.json({ ok: true });

    // invalida tokens antigos ainda não usados
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email/${token}`;

    await sendEmailVerification({
      to: user.email,
      name: user.name,
      verifyUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[RESEND-VERIFICATION] error:", e);
    return NextResponse.json(
      { ok: false, message: "Erro ao reenviar link." },
      { status: 500 }
    );
  }
}
