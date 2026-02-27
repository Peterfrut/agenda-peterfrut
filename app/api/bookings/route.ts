// app/api/bookings/route.ts
import { sendBookingEmail, type BookingLike } from "@/lib/mail";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { intervalsOverlap, isWithinWorkingHours } from "@/lib/time";
import { ROOMS } from "@/lib/rooms";
import prisma from "@/lib/prisma";
import { getTokenFromRequest, verifyJwt } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

import { addDays, addMonths, addWeeks, format, getDay, parseISO } from "date-fns";
import { isStep30Minutes, isValidEmail, normEmail, splitEmails } from "@/lib/formatters";

// ===================================
// Helpers: normalização e validação
// ===================================





// ===================================
// Recorrência
// ===================================

type RecurrenceMode = "none" | "daily" | "weekly" | "monthly" | "weeklyByDay";

type RecurrenceInput = {
  mode: RecurrenceMode;
  until?: string;
  weekDays?: number[]; 
};

const MAX_OCCURRENCES = 180;

function expandRecurrenceDates(startDateISO: string, r?: RecurrenceInput): string[] {
  if (!r || r.mode === "none") return [startDateISO];

  const start = parseISO(startDateISO);
  const until = r.until ? parseISO(r.until) : addMonths(start, 3);

  const out: string[] = [];
  const push = (d: Date) => out.push(format(d, "yyyy-MM-dd"));

  if (r.mode === "daily") {
    let cur = start;
    while (cur <= until && out.length < MAX_OCCURRENCES) {
      push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }

  if (r.mode === "weekly") {
    let cur = start;
    while (cur <= until && out.length < MAX_OCCURRENCES) {
      push(cur);
      cur = addWeeks(cur, 1);
    }
    return out;
  }

  if (r.mode === "monthly") {
    let cur = start;
    while (cur <= until && out.length < MAX_OCCURRENCES) {
      push(cur);
      cur = addMonths(cur, 1);
    }
    return out;
  }

  // weeklyByDay
  const weekDays = (r.weekDays ?? []).filter((n) => n >= 0 && n <= 6);
  if (!weekDays.length) return [startDateISO];

  let cur = start;
  while (cur <= until && out.length < MAX_OCCURRENCES) {
    const dow = getDay(cur);
    if (weekDays.includes(dow)) push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

// ===================================
// FERIADOS NACIONAIS (BrasilAPI)
// Bloqueio somente para "national"
// ===================================

type BrasilApiHoliday = { date: string; name: string; type: "national" | string };

// cache simples em memória (evita bater na API a toda hora)
const nationalHolidayCache = new Map<number, Set<string>>();

async function getNationalHolidayDatesSet(year: number): Promise<Set<string>> {
  const cached = nationalHolidayCache.get(year);
  if (cached) return cached;

  const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
    // cache do Next no server
    next: { revalidate: 60 * 60 * 24 }, // 24h
  });

  if (!res.ok) {
    throw new Error(`BrasilAPI falhou: ${res.status}`);
  }

  const list = (await res.json()) as BrasilApiHoliday[];
  const set = new Set(
    list
      .filter((h) => h.type === "national")
      .map((h) => h.date) // YYYY-MM-DD
  );

  nationalHolidayCache.set(year, set);
  return set;
}

async function isNationalHoliday(dateISO: string): Promise<boolean> {
  const year = Number(dateISO.slice(0, 4));
  if (!Number.isFinite(year)) return false;

  const set = await getNationalHolidayDatesSet(year);
  return set.has(dateISO);
}

// ===================================
// Schemas Zod
// ===================================

const bookingSchema = z
  .object({
    roomId: z.string(),
    userName: z.string().min(2),
    participantsEmails: z.string().optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    title: z.string().max(120),

    recurrence: z
      .object({
        mode: z.enum(["none", "daily", "weekly", "monthly", "weeklyByDay"]),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        weekDays: z.array(z.number().int().min(0).max(6)).optional(),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (!isStep30Minutes(val.startTime) || !isStep30Minutes(val.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horários devem estar em passos de 30 minutos (ex.: 06:00, 06:30, 07:00).",
        path: ["startTime"],
      });
    }

    if (val.participantsEmails) {
      const emails = splitEmails(val.participantsEmails);
      const invalid = emails.filter((e) => !isValidEmail(e));
      if (invalid.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `E-mail(s) inválido(s): ${invalid.join(", ")}`,
          path: ["participantsEmails"],
        });
      }
    }

    if (val.recurrence?.mode === "weeklyByDay") {
      const days = val.recurrence.weekDays ?? [];
      if (!days.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione ao menos um dia da semana para a repetição.",
          path: ["recurrence", "weekDays"],
        });
      }
    }
  });

const updateSchema = z
  .object({
    id: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .superRefine((val, ctx) => {
    if (!isStep30Minutes(val.startTime) || !isStep30Minutes(val.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horários devem estar em passos de 30 minutos (ex.: 06:00, 06:30, 07:00).",
        path: ["startTime"],
      });
    }
  });

const deleteSchema = z.object({ id: z.string() });

async function getLoggedUserEmail(req: NextRequest): Promise<string | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = await verifyJwt(token);
  const email = (payload as any)?.email;
  return typeof email === "string" ? email : null;
}

async function getLoggedUser(req: NextRequest): Promise<{ email: string | null; role: string | null }> {
  const token = getTokenFromRequest(req);
  if (!token) return { email: null, role: null };
  const payload = await verifyJwt(token);
  const email = typeof (payload as any)?.email === "string" ? (payload as any).email : null;
  const role = typeof (payload as any)?.role === "string" ? (payload as any).role : null;
  return { email, role };
}

const MY_AGENDA_ID = "__my__";

// -------------------- GET -------------------- //

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const roomId = searchParams.get("roomId");
  const date = searchParams.get("date");
  const all = searchParams.get("_all");
  const scope = searchParams.get("scope");

  if (scope === "my") {
    const email = await getLoggedUserEmail(req);
    const emailNorm = normEmail(email);
    if (!emailNorm) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const where: any = {
      OR: [{ userEmail: emailNorm }, { participantsEmails: { contains: emailNorm } }],
    };
    if (date && !all) where.date = date;

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(bookings);
  }

  const where: any = {};
  if (roomId) where.roomId = roomId;
  if (date && !all) where.date = date;

  const bookings = await prisma.booking.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(bookings);
}

// -------------------- POST -------------------- //

export async function POST(req: NextRequest) {
  try {
    const me = await getLoggedUser(req);
    const loggedEmailNorm = normEmail(me.email);
    const isAdmin = me.role === "admin";
    if (!loggedEmailNorm) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const rl = rateLimit(`booking:create:${loggedEmailNorm}`, 10, 60_000);
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Muitas reservas em pouco tempo. Tente novamente em ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const json = await req.json();
    const data = bookingSchema.parse(json);

    const participantsArr = data.participantsEmails ? splitEmails(data.participantsEmails) : [];
    const uniq = Array.from(new Set(participantsArr)).filter((e) => e !== loggedEmailNorm);
    const participantsNorm = uniq.length ? uniq.join(",") : null;

    const isPersonalAgenda = data.roomId === MY_AGENDA_ID;

    let roomName: string;
    if (isPersonalAgenda) {
      roomName = "Agenda Pessoal";
    } else {
      const room = ROOMS.find((r) => r.id === data.roomId);
      if (!room) return NextResponse.json({ error: "Sala inválida." }, { status: 400 });
      roomName = room.name;
    }

    if (!isWithinWorkingHours(data.startTime, data.endTime)) {
      return NextResponse.json(
        { error: "Horário fora do expediente (06:00 às 17:30)." },
        { status: 400 }
      );
    }

    if (!isStep30Minutes(data.startTime) || !isStep30Minutes(data.endTime)) {
      return NextResponse.json(
        { error: "Horários devem estar em passos de 30 minutos (ex.: 06:00, 06:30, 07:00)." },
        { status: 400 }
      );
    }

    // expandir datas (recorrência)
    let dates = expandRecurrenceDates(data.date, data.recurrence);

    // Se for diária, ignora finais de semana e feriados nacionais (cria só dias úteis)
    if (data.recurrence?.mode === "daily") {
      // 1) tira finais de semana
      dates = dates.filter((iso) => {
        const dow = getDay(parseISO(iso)); // 0 dom, 6 sab
        return dow !== 0 && dow !== 6;
      });

      // 2) tira feriados nacionais
      try {
        const filtered: string[] = [];
        for (const d of dates) {
          const national = await isNationalHoliday(d);
          if (!national) filtered.push(d);
        }
        dates = filtered;
      } catch (e) {
        // fail-open: se BrasilAPI falhar, não travar o sistema
        console.warn("Falha ao consultar feriados nacionais. Prosseguindo sem filtrar.", e);
      }

      if (dates.length === 0) {
        return NextResponse.json(
          { error: "No período selecionado, não há dias úteis disponíveis (finais de semana e feriados nacionais foram ignorados)." },
          { status: 409 }
        );
      }
    } else {
      // se cair em feriado nacional, bloqueia a ocorrência (ou tudo, se você preferir).
      try {
        for (const d of dates) {
          const national = await isNationalHoliday(d);
          if (national) {
            return NextResponse.json(
              { error: `Não é permitido agendar em feriado nacional.` },
              { status: 409 }
            );
          }
        }
      } catch (e) {
        console.warn("Falha ao consultar feriados nacionais. Prosseguindo sem bloqueio.", e);
      }
    }

    // conflito em todas as ocorrências
    for (const d of dates) {
      const sameDay = await prisma.booking.findMany({
        where: isPersonalAgenda
          ? { roomId: data.roomId, date: d, userEmail: loggedEmailNorm }
          : { roomId: data.roomId, date: d },
      });

      const conflict = sameDay.some((b) =>
        intervalsOverlap(data.startTime, data.endTime, b.startTime, b.endTime)
      );

      if (conflict) {
        return NextResponse.json(
          { error: `Já existe uma reserva que se sobrepõe a esse horário em ${d}.` },
          { status: 409 }
        );
      }
    }

    // cria tudo em transação
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const d of dates) {
        const booking = await tx.booking.create({
          data: {
            roomId: data.roomId,
            roomName,
            userName: data.userName,
            userEmail: loggedEmailNorm,
            participantsEmails: participantsNorm,
            date: d,
            startTime: data.startTime,
            endTime: data.endTime,
            title: data.title ?? null,
          },
        });
        rows.push(booking);
      }
      return rows;
    });

    await sendBookingEmail("created", created[0] as BookingLike);

    return NextResponse.json(created[0], {
      status: 201,
      headers: { "X-Created-Count": String(created.length) },
    });
  } catch (err: any) {
    console.error(err);
    if (err?.name === "ZodError") {
      const msg = err?.issues?.[0]?.message || "Dados inválidos.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao criar reserva." }, { status: 500 });
  }
}

// -------------------- PATCH -------------------- //

export async function PATCH(req: NextRequest) {
  try {
    const me = await getLoggedUser(req);
    const loggedEmailNorm = normEmail(me.email);
    const isAdmin = me.role === "admin";
    if (!loggedEmailNorm) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const rl = rateLimit(`booking:update:${loggedEmailNorm}`, 10, 60_000);
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Muitas alterações em pouco tempo. Tente novamente em ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const json = await req.json();
    const data = updateSchema.parse(json);

    const booking = await prisma.booking.findUnique({ where: { id: data.id } });
    if (!booking) return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });

    if (!isAdmin && normEmail(booking.userEmail) !== loggedEmailNorm) {
      return NextResponse.json(
        { error: "Você não pode remarcar uma reserva de outro usuário." },
        { status: 403 }
      );
    }

    if (!isWithinWorkingHours(data.startTime, data.endTime)) {
      return NextResponse.json(
        { error: "Horário fora do expediente (06:00 às 17:30)." },
        { status: 400 }
      );
    }

    if (!isStep30Minutes(data.startTime) || !isStep30Minutes(data.endTime)) {
      return NextResponse.json(
        { error: "Horários devem estar em passos de 30 minutos (ex.: 06:00, 06:30, 07:00)." },
        { status: 400 }
      );
    }

    // opcional: também bloquear remarcar para feriado nacional
    try {
      const national = await isNationalHoliday(data.date);
      if (national) {
        return NextResponse.json(
          { error: `Não é permitido agendar em feriado nacional (${data.date}).` },
          { status: 409 }
        );
      }
    } catch (e) {
      console.warn("Falha ao consultar feriados nacionais no PATCH. Prosseguindo sem bloqueio.", e);
    }

    const sameDay = await prisma.booking.findMany({
      where: { roomId: booking.roomId, date: data.date, NOT: { id: booking.id } },
    });

    const conflict = sameDay.some((b) =>
      intervalsOverlap(data.startTime, data.endTime, b.startTime, b.endTime)
    );
    if (conflict) {
      return NextResponse.json(
        { error: "Já existe uma reserva que se sobrepõe a esse horário." },
        { status: 409 }
      );
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { date: data.date, startTime: data.startTime, endTime: data.endTime },
    });

    await sendBookingEmail("updated", updated as BookingLike);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error(err);
    if (err?.name === "ZodError") {
      const msg = err?.issues?.[0]?.message || "Dados inválidos.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao remarcar reserva." }, { status: 500 });
  }
}

// -------------------- DELETE -------------------- //

export async function DELETE(req: NextRequest) {
  try {
    const me = await getLoggedUser(req);
    const loggedEmailNorm = normEmail(me.email);
    const isAdmin = me.role === "admin";
    if (!loggedEmailNorm) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const rl = rateLimit(`booking:delete:${loggedEmailNorm}`, 10, 60_000);
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Muitas exclusões em pouco tempo. Tente novamente em ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const json = await req.json();
    const data = deleteSchema.parse(json);

    const booking = await prisma.booking.findUnique({ where: { id: data.id } });
    if (!booking) return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });

    if (!isAdmin && normEmail(booking.userEmail) !== loggedEmailNorm) {
      return NextResponse.json(
        { error: "Você não pode excluir uma reserva de outro usuário." },
        { status: 403 }
      );
    }

    await prisma.booking.delete({ where: { id: booking.id } });
    await sendBookingEmail("canceled", booking as BookingLike);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    if (err?.name === "ZodError") {
      const msg = err?.issues?.[0]?.message || "Dados inválidos.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao excluir reserva." }, { status: 500 });
  }
}
