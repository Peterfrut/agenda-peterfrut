import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function normalizeToken(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  try {
    const token = normalizeToken(req.nextUrl.searchParams.get("token"));

    if (!token) {
      return NextResponse.json(
        { ok: false, reason: "invalid" },
        { status: 400 }
      );
    }

    const prt = await prisma.passwordResetToken.findFirst({
      where: { token },
      select: { id: true, expiresAt: true },
    });

    if (!prt) {
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
