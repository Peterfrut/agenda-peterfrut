import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendEmailVerification } from "@/lib/verify-email-mail";
import { isPeterfrutEmail, normEmail } from "@/lib/formatters";
import { rateLimit } from "@/lib/rate-limit";
import { getAppBaseUrl, getClientIp, retryAfterResponse } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const body = await req.json().catch(() => ({}));
    const email = normEmail(body?.email);

    if (!email) {
      return NextResponse.json({ ok: false, message: "Informe o e-mail." }, { status: 400 });
    }

    const rlIp = rateLimit(`resend-verification:ip:${ip}`, 5, 60_000);
    const rlEmail = rateLimit(`resend-verification:email:${email}`, 3, 60_000);
    if (!rlIp.ok) return retryAfterResponse("Muitas tentativas.", rlIp.resetAt);
    if (!rlEmail.ok) return retryAfterResponse("Muitas tentativas para este e-mail.", rlEmail.resetAt);

    if (!isPeterfrutEmail(email)) return NextResponse.json({ ok: true });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, active: true, emailVerifiedAt: true },
    });

    if (!user?.active) return NextResponse.json({ ok: true });
    if (user.emailVerifiedAt) return NextResponse.json({ ok: true });

    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    await sendEmailVerification({
      to: user.email,
      name: user.name,
      verifyUrl: `${getAppBaseUrl()}/verify-email/${token}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[RESEND-VERIFICATION] error:", e);
    return NextResponse.json({ ok: false, message: "Erro ao reenviar link." }, { status: 500 });
  }
}
