import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmailVerification } from "@/lib/verify-email-mail";

function normEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function isPeterfrutEmail(email: string) {
  return email.endsWith("@peterfrut.com.br");
}

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : "ip:unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);


  // Ex.: 5 cadastros/min por IP
  const rl = rateLimit(`register:ip:${ip}`, 5, 60_000);
  if (!rl.ok) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { ok: false, message: `Muitas tentativas. Tente novamente em ${retryAfter}s.`},
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const { name, email, password } = await req.json();
    const emailNorm = normEmail(email);

    if (!isPeterfrutEmail(emailNorm)) {
      return NextResponse.json(
        { ok: false, message: "Utilize o e-mail corporativo com o domínio @peterfrut.com.br. Caso não tenha solicite a criação ao TI." },
        { status: 400 }
      );
    }

    if (!name || !emailNorm || !password) {
      return NextResponse.json(
        { ok: false, message: "Nome, e-mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, message: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      // se já existe e NÃO verificou, você pode optar por reenviar ao invés de bloquear
      return NextResponse.json(
        { ok: false, message: "Já existe um usuário com este e-mail" },
        { status: 409 }
      );
    }


    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email: emailNorm, password: hash },
      select: { id: true, email: true, name: true },
    });

    // token 15 min
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
    console.error("[REGISTER] error:", e);
    return NextResponse.json(
      { ok: false, message: "Erro ao criar usuário" },
      { status: 500 }
    );
  }
}
