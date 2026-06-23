import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/password-reset-mail";
import { isPeterfrutEmail, normEmail } from "@/lib/formatters";
import { rateLimit } from "@/lib/rate-limit";
import { getAppBaseUrl, getClientIp, retryAfterResponse } from "@/lib/security";
import { createUrlToken, hashUrlToken } from "@/lib/token-security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const body = await req.json().catch(() => ({}));
    const email = normEmail(body?.email);

    if (!email) {
      return NextResponse.json({ ok: false, message: "Informe o e-mail" }, { status: 400 });
    }

    const rlIp = rateLimit(`forgot-password:ip:${ip}`, 5, 60_000);
    const rlEmail = rateLimit(`forgot-password:email:${email}`, 3, 60_000);
    if (!rlIp.ok) return retryAfterResponse("Muitas tentativas.", rlIp.resetAt);
    if (!rlEmail.ok) return retryAfterResponse("Muitas tentativas para este e-mail.", rlEmail.resetAt);

    if (!isPeterfrutEmail(email)) {
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, active: true },
    });

    if (!user?.active) {
      return NextResponse.json({ ok: true });
    }

    const token = createUrlToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await prisma.passwordResetToken.create({
      data: {
        token: hashUrlToken(token),
        userId: user.id,
        expiresAt,
      },
    });

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: `${getAppBaseUrl()}/reset-password/${token}`,
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
