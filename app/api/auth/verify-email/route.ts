import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeToken } from "@/lib/formatters";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = normalizeToken(body?.token);

    if (!token) {
      return NextResponse.json({ ok: false, code: "INVALID", message: "Token inválido." }, { status: 400 });
    }

    const evt = await prisma.emailVerificationToken.findFirst({
      where: { token },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!evt) {
      return NextResponse.json({ ok: false, code: "INVALID", message: "Token inválido." }, { status: 400 });
    }

    if (evt.usedAt) {
      return NextResponse.json({ ok: true, code: "ALREADY_VERIFIED" });
    }

    if (evt.expiresAt <= new Date()) {
      return NextResponse.json(
        { ok: false, code: "EXPIRED", message: "Tempo limite de confirmação expirou." },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: evt.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: evt.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true, code: "VERIFIED" });
  } catch (e) {
    console.error("[VERIFY-EMAIL] error:", e);
    return NextResponse.json(
      { ok: false, message: "Erro interno ao confirmar e-mail." },
      { status: 500 }
    );
  }
}
