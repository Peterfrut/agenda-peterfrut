import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ ok: true, users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      active: true,
      emailVerifiedAt: { not: null },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 10,
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return NextResponse.json({ ok: true, users });
}
