import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

type BrasilApiHoliday = {
  date: string;
  name: string;
  type: "national" | string;
};

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "start e end são obrigatórios" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      return NextResponse.json({ error: "Intervalo de datas invÃ¡lido" }, { status: 400 });
    }

    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days > 370) {
      return NextResponse.json({ error: "Intervalo mÃ¡ximo de consulta: 370 dias" }, { status: 400 });
    }

    const year = Number(start.slice(0, 4));
    if (!Number.isFinite(year)) {
      return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
    }

    // 1) nacionais via BrasilAPI — FAIL OPEN
    let national: BrasilApiHoliday[] = [];
    try {
      const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
        next: { revalidate: 60 * 60 * 24 }, // 24h
      });

      if (r.ok) {
        national = (await r.json()) as BrasilApiHoliday[];
      }
    } catch {
      // fail-open: não derruba a rota
      national = [];
    }

    const nationalFiltered = national
      .filter((h) => h.type === "national" && h.date >= start && h.date <= end)
      .map((h) => ({
        id: `br-${h.date}`,
        date: h.date,
        name: h.name,
        roomId: null as string | null,
        source: "national" as const,
      }));

    // 2) locais (DB) — se roomId existir, traz global (null) + sala
    const local = await prisma.holiday.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(roomId ? { OR: [{ roomId: null }, { roomId }] } : {}),
      },
      orderBy: { date: "asc" },
    });

    // Normaliza retorno do DB
    const localMapped = local.map((h) => ({
      id: h.id,
      date: h.date,
      name: h.name,
      roomId: h.roomId,
      source: "local" as const,
    }));

    return NextResponse.json([...nationalFiltered, ...localMapped]);
  } catch (err) {
    console.error(err);
    // fail-open total: em caso de erro inesperado, não quebre UI
    return NextResponse.json([]);
  }
}
