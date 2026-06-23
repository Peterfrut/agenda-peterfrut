import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUrlTokenLookupValues } from "@/lib/token-security";

export async function GET(req: NextRequest) {
  try {
    const tokenLookup = getUrlTokenLookupValues(req.nextUrl.searchParams.get("token"));

    if (!tokenLookup) {
      return NextResponse.json(
        { ok: false, reason: "invalid" },
        { status: 400 }
      );
    }

    const prt = await prisma.passwordResetToken.findFirst({
      where: {
        OR: [{ token: tokenLookup.hashed }, { token: tokenLookup.raw }],
        usedAt: null,
      },
      select: { id: true, expiresAt: true, user: { select: { active: true } } },
    });

    if (!prt?.user.active) {
      return NextResponse.json({ ok: false, reason: "invalid" }, { status: 200 });
    }

    const now = Date.now();
    const exp = new Date(prt.expiresAt).getTime();

    if (exp <= now) {
      return NextResponse.json(
        { ok: false, reason: "expired" },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[RESET-VALIDATE] error:", e);
    return NextResponse.json(
      { ok: false, reason: "error" },
      { status: 500 }
    );
  }
}
