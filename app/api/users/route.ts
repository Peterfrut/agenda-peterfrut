import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const pageNum = Math.max(1, Number(searchParams.get("page") || 1));
  const sizeNum = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") || 20)));
  const skip = (pageNum - 1) * sizeNum;

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ name: "asc" }, { email: "asc" }],
      skip,
      take: sizeNum,
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        role: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    page: pageNum,
    pageSize: sizeNum,
    total,
    users,
  });
}
