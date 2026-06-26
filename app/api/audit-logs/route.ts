import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  auth: "Acessos",
  users: "Usuarios",
  bookings: "Agendamentos",
  requests: "Solicitacoes",
  import: "Importacoes",
  system: "Sistema",
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const pageSizeRaw = Number(searchParams.get("pageSize") || 80);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(150, Math.max(10, Math.floor(pageSizeRaw))) : 80;

  const where: Prisma.AuditLogWhereInput = {};

  if (category && category !== "all") {
    where.category = category;
  }

  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { actorName: { contains: q, mode: "insensitive" } },
      { actorEmail: { contains: q, mode: "insensitive" } },
      { targetLabel: { contains: q, mode: "insensitive" } },
      { targetType: { contains: q, mode: "insensitive" } },
    ];
  }

  const [logs, categoryGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      select: {
        id: true,
        action: true,
        category: true,
        severity: true,
        actorName: true,
        actorEmail: true,
        targetType: true,
        targetId: true,
        targetLabel: true,
        ip: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.groupBy({
      by: ["category"],
      _count: { _all: true },
    }),
  ]);

  const categories = categoryGroups
    .map((item) => ({
      id: item.category,
      label: CATEGORY_LABELS[item.category] ?? item.category,
      count: item._count._all,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  return NextResponse.json({
    ok: true,
    logs,
    categories,
  });
}
