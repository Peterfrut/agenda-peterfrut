import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { PASSWORD_RULES_MESSAGE, validatePassword } from "@/lib/formatters";
import { getClientIp, retryAfterResponse } from "@/lib/security";
import { getUrlTokenLookupValues } from "@/lib/token-security";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rl = rateLimit(`reset:ip:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return retryAfterResponse("Muitas tentativas.", rl.resetAt);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body invalido." }, { status: 400 });
  }

  const tokenLookup = getUrlTokenLookupValues(body?.token);
  const password = String(body?.password ?? "");
  if (!tokenLookup || !password) {
    return NextResponse.json(
      { ok: false, message: "Token e nova senha sao obrigatorios." },
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
    where: { OR: [{ token: tokenLookup.hashed }, { token: tokenLookup.raw }] },
    include: { user: { select: { id: true, active: true } } },
  });

  if (!prt || !prt.user.active) {
    return NextResponse.json({ ok: false, message: "Token invalido." }, { status: 400 });
  }
  if (prt.usedAt) {
    return NextResponse.json({ ok: false, message: "Token ja utilizado." }, { status: 400 });
  }
  if (prt.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, message: "Token expirado." }, { status: 400 });
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

  return NextResponse.json({ ok: true });
}
