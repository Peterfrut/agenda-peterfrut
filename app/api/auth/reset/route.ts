import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : "ip:unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Ex.: 10 resets/min por IP
  const rl = rateLimit(`reset:ip:${ip}`, 10, 60_000);
  if (!rl.ok) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { ok: false, message: `Muitas tentativas. Tente novamente em ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body inválido." }, { status: 400 });
  }

  const token = String(body?.token ?? "").trim();
  const password = String(body?.password ?? "");
  if (!token || !password) {
    return NextResponse.json(
      { ok: false, message: "Token e nova senha são obrigatórios." },
      { status: 400 }
    );
  }

  const prt = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true } } },
  });

  if (!prt) {
    return NextResponse.json({ ok: false, message: "Token inválido." }, { status: 400 });
  }
  if (prt.usedAt) {
    return NextResponse.json({ ok: false, message: "Token já utilizado." }, { status: 400 });
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
