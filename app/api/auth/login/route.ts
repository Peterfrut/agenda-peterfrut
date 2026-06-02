import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signJwt } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, retryAfterResponse } from "@/lib/security";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // 1) Rate limit por IP (antes de qualquer coisa pesada)
  const rlIp = rateLimit(`login:ip:${ip}`, 8, 60_000);
  if (!rlIp.ok) {
    return retryAfterResponse("Muitas tentativas.", rlIp.resetAt);
  }

  // 2) Leia o body UMA ÚNICA VEZ
  const body = await req.json().catch(() => ({}));

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  // 3) Rate limit por e-mail (opcional)
  if (email) {
    const rlEmail = rateLimit(`login:email:${email}`, 5, 60_000);
    if (!rlEmail.ok) {
      return retryAfterResponse("Muitas tentativas para este e-mail.", rlEmail.resetAt);
    }
  }


  // 4) Validação
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "Email e senha são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    // 5) Procura usuário usando email normalizado
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { ok: false, message: "Usuário inativo. Procure o TI." },
        { status: 403 }
      );
    }

    // BLOQUEIA se não confirmou email
    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { ok: false, message: "Verifique seu e-mail primeiro." },
        { status: 403 }
      );
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return NextResponse.json(
        { ok: false, message: "Credenciais inválidas" },
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
      maxAge: 60 * 60 * 8, // 8h
      sameSite: "lax",
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
