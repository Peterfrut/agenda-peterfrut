// app/api/bookings/route.ts
import {
  getTeamsUrlForRoom,
  sendBookingEmail,
  sendBookingParticipantEmail,
  type BookingLike,
} from "@/lib/mail";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { intervalsOverlap, isWithinWorkingHours } from "@/lib/time";
import { ROOMS } from "@/lib/rooms";
import prisma from "@/lib/prisma";
import type { Booking as PrismaBooking, Prisma } from "@prisma/client";
import { requireUser, type SessionUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { retryAfterResponse } from "@/lib/security";
import { createNotificationForEmail } from "@/lib/notifications";
import { createAuditLog } from "@/lib/audit-log";

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
const LONG_BOOKING_MINUTES = 180;
const HIGH_RECURRENCE_OCCURRENCES = 20;

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
    roomId: z.string().min(1).max(80),
    userName: z.string().min(2).max(75),
    participantsEmails: z.string().max(2000).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    title: z.string().trim().min(1).max(120),
    longReason: z.string().trim().max(600).optional().nullable(),

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
      if (emails.length > 50) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Limite de 50 participantes por reserva.",
          path: ["participantsEmails"],
        });
      }
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

    if (val.recurrence?.until && val.recurrence.until < val.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data final da repetição não pode ser anterior à data inicial.",
        path: ["recurrence", "until"],
      });
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

const participantsUpdateSchema = z
  .object({
    id: z.string(),
    title: z.string().trim().min(1).max(120).optional(),
    longReason: z.string().trim().max(600).optional().nullable(),
    participantsEmails: z.string().max(2000).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (!val.participantsEmails) return;

    const emails = splitEmails(val.participantsEmails);
    if (emails.length > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Limite de 50 participantes por reserva.",
        path: ["participantsEmails"],
      });
    }

    const invalid = emails.filter((e) => !isValidEmail(e));
    if (invalid.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `E-mail(s) invalido(s): ${invalid.join(", ")}`,
        path: ["participantsEmails"],
      });
    }
  });

const deleteSchema = z.object({ id: z.string() });

const MY_AGENDA_ID = "__my__";

class BookingApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function participantList(value: string | null) {
  return splitEmails(value ?? "");
}

function isParticipant(booking: Pick<PrismaBooking, "participantsEmails">, email: string) {
  return participantList(booking.participantsEmails).includes(normEmail(email));
}

function bookingInvolvesEmail(
  booking: Pick<PrismaBooking, "userEmail" | "participantsEmails">,
  email: string
) {
  const emailNorm = normEmail(email);
  return normEmail(booking.userEmail) === emailNorm || isParticipant(booking, emailNorm);
}

function bookingDurationMinutes(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  return eh * 60 + em - (sh * 60 + sm);
}

function toBookingDto(booking: PrismaBooking, user: SessionUser) {
  const isOwner = normEmail(booking.userEmail) === user.email;
  const participant = isParticipant(booking, user.email);
  const canManage = user.role === "admin" || isOwner;
  const canViewParticipants = canManage || participant;

  return {
    id: booking.id,
    roomId: booking.roomId,
    roomName: booking.roomName,
    title: booking.title,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    userName: booking.userName,
    userEmail: canManage ? booking.userEmail : "",
    participantsEmails: canViewParticipants ? booking.participantsEmails : null,
    longReason: canViewParticipants ? booking.longReason : null,
    status: booking.status,
    provider: booking.provider,
    externalSource: user.role === "admin" ? booking.externalSource : null,
    externalId: user.role === "admin" ? booking.externalId : null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    isOwner,
    isParticipant: participant,
    canManage,
    canViewParticipants,
  };
}

async function sendBookingEmailSafely(kind: "created" | "updated" | "canceled" | "reminder", booking: BookingLike) {
  try {
    await sendBookingEmail(kind, booking);
  } catch (err) {
    console.error(`[BOOKING MAIL] Falha ao enviar e-mail de ${kind}. A reserva foi mantida.`, err);
  }
}

async function sendParticipantEmailSafely(
  kind: "created" | "updated" | "canceled",
  booking: BookingLike,
  email: string
) {
  try {
    await sendBookingParticipantEmail(kind, booking, email);
  } catch (err) {
    console.error(`[BOOKING MAIL] Falha ao enviar e-mail de ${kind} para ${email}.`, err);
  }
}

type BookingNotificationKind = "created" | "updated" | "canceled";
type BookingNotificationRole = "owner" | "participant";

function bookingDisplayTitle(booking: BookingLike) {
  return booking.title?.trim() || "Agendamento";
}

function bookingDateTimeLabel(booking: BookingLike) {
  return `${booking.date} das ${booking.startTime} as ${booking.endTime}`;
}

function bookingNotificationHref(booking: BookingLike, kind: BookingNotificationKind) {
  if (kind === "canceled") return null;
  return getTeamsUrlForRoom(booking.roomId) || null;
}

function bookingNotificationMetadata(
  kind: BookingNotificationKind,
  role: BookingNotificationRole,
  booking: BookingLike
) {
  const title = bookingDisplayTitle(booking);
  const participants = splitEmails(booking.participantsEmails ?? "");
  const details = [
    { label: "Titulo", value: title },
    { label: "Sala", value: booking.roomName },
    { label: "Data", value: booking.date },
    { label: "Horario da reuniao", value: `${booking.startTime} as ${booking.endTime}` },
    { label: "Quem agendou", value: `${booking.userName} (${booking.userEmail})` },
  ];

  const action =
    kind === "created"
      ? role === "participant"
        ? "Voce recebeu um convite para esta reuniao."
        : "Seu agendamento foi confirmado."
      : kind === "updated"
        ? "Os dados desta reuniao foram atualizados."
        : "Esta reuniao foi cancelada.";

  return {
    description: action,
    details,
    participants,
  };
}

function bookingNotificationText(
  kind: BookingNotificationKind,
  role: BookingNotificationRole,
  booking: BookingLike
) {
  const title = bookingDisplayTitle(booking);
  const dateTime = bookingDateTimeLabel(booking);

  if (role === "participant") {
    if (kind === "created") {
      return {
        type: "booking_guest_invited",
        title: "Voce foi convidado",
        message: `${booking.userName} convidou voce para "${title}" em ${booking.roomName}, ${dateTime}.`,
      };
    }

    if (kind === "updated") {
      return {
        type: "booking_guest_updated",
        title: "Reuniao atualizada",
        message: `A reuniao "${title}" em ${booking.roomName} foi atualizada para ${dateTime}.`,
      };
    }

    return {
      type: "booking_guest_canceled",
      title: "Reuniao cancelada",
      message: `A reuniao "${title}" em ${booking.roomName}, ${dateTime}, foi cancelada.`,
    };
  }

  if (kind === "created") {
    return {
      type: "booking_owner_confirmed",
      title: "Agendamento confirmado",
      message: `Sua reserva "${title}" em ${booking.roomName} foi confirmada para ${dateTime}.`,
    };
  }

  if (kind === "updated") {
    return {
      type: "booking_owner_updated",
      title: "Agendamento atualizado",
      message: `Sua reserva "${title}" em ${booking.roomName} foi atualizada para ${dateTime}.`,
    };
  }

  return {
    type: "booking_owner_canceled",
    title: "Agendamento excluido",
    message: `Sua reserva "${title}" em ${booking.roomName}, ${dateTime}, foi excluida.`,
  };
}

async function createBookingNotificationSafely(
  kind: BookingNotificationKind,
  role: BookingNotificationRole,
  booking: BookingLike,
  email: string
) {
  const text = bookingNotificationText(kind, role, booking);

  try {
    await createNotificationForEmail(email, {
      ...text,
      href: bookingNotificationHref(booking, kind),
      metadata: bookingNotificationMetadata(kind, role, booking),
    });
  } catch (err) {
    console.error(`[BOOKING NOTIFICATION] Falha ao criar notificacao para ${email}.`, err);
  }
}

async function notifyBookingSafely(kind: BookingNotificationKind, booking: BookingLike) {
  await createBookingNotificationSafely(kind, "owner", booking, booking.userEmail);

  const participants = splitEmails(booking.participantsEmails ?? "");
  for (const email of participants) {
    await createBookingNotificationSafely(kind, "participant", booking, email);
  }
}

async function lockBookingDay(tx: Prisma.TransactionClient, roomId: string, date: string, email?: string) {
  const scope = email ? `${roomId}:${date}:${email}` : `${roomId}:${date}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}))`;
}

async function assertUserHasNoOverlappingBooking(
  tx: Prisma.TransactionClient,
  params: {
    email: string;
    date: string;
    startTime: string;
    endTime: string;
    excludeBookingId?: string;
  }
) {
  const emailNorm = normEmail(params.email);
  const candidates = await tx.booking.findMany({
    where: {
      date: params.date,
      ...(params.excludeBookingId ? { NOT: { id: params.excludeBookingId } } : {}),
      OR: [{ userEmail: emailNorm }, { participantsEmails: { contains: emailNorm } }],
    },
  });

  const conflict = candidates.find(
    (booking) =>
      bookingInvolvesEmail(booking, emailNorm) &&
      intervalsOverlap(params.startTime, params.endTime, booking.startTime, booking.endTime)
  );

  if (conflict) {
    throw new BookingApiError(
      `Voce ja possui compromisso em ${params.date} das ${conflict.startTime} as ${conflict.endTime}.`,
      409
    );
  }
}

// -------------------- GET -------------------- //

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { searchParams } = new URL(req.url);

  const roomId = searchParams.get("roomId");
  const date = searchParams.get("date");
  const all = searchParams.get("_all");
  const scope = searchParams.get("scope");

  if (scope === "my") {
    const emailNorm = auth.user.email;

    const where: Prisma.BookingWhereInput = {
      OR: [{ userEmail: emailNorm }, { participantsEmails: { contains: emailNorm } }],
    };
    if (date && !all) where.date = date;

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const filtered = bookings.filter(
      (booking) => normEmail(booking.userEmail) === emailNorm || isParticipant(booking, emailNorm)
    );

    return NextResponse.json(filtered.map((booking) => toBookingDto(booking, auth.user)));
  }

  const where: Prisma.BookingWhereInput = {};
  if (roomId) where.roomId = roomId;
  if (date && !all) where.date = date;

  const bookings = await prisma.booking.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(bookings.map((booking) => toBookingDto(booking, auth.user)));
}

// -------------------- POST -------------------- //

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
    const loggedEmailNorm = auth.user.email;

    const rl = rateLimit(`booking:create:${loggedEmailNorm}`, 10, 60_000);
    if (!rl.ok) {
      return retryAfterResponse("Muitas reservas em pouco tempo.", rl.resetAt);
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

    if (dates.length === 0) {
      return NextResponse.json({ error: "Nenhuma ocorrência válida para criar." }, { status: 400 });
    }

    // cria tudo em transação com trava por sala/dia para evitar corrida
    const requiresLongReason =
      bookingDurationMinutes(data.startTime, data.endTime) > LONG_BOOKING_MINUTES ||
      dates.length > HIGH_RECURRENCE_OCCURRENCES;
    const longReason = data.longReason?.trim() || null;

    if (requiresLongReason && !longReason) {
      return NextResponse.json(
        {
          error:
            "Informe uma justificativa para reservas com mais de 3 horas ou recorrencia acima de 20 ocorrencias.",
        },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows: PrismaBooking[] = [];
      for (const d of dates) {
        await lockBookingDay(tx, data.roomId, d, isPersonalAgenda ? loggedEmailNorm : undefined);
        await lockBookingDay(tx, "user-calendar", d, loggedEmailNorm);
        await assertUserHasNoOverlappingBooking(tx, {
          email: loggedEmailNorm,
          date: d,
          startTime: data.startTime,
          endTime: data.endTime,
        });

        const sameDay = await tx.booking.findMany({
          where: isPersonalAgenda
            ? { roomId: data.roomId, date: d, userEmail: loggedEmailNorm }
            : { roomId: data.roomId, date: d },
        });

        const conflict = sameDay.some((b) =>
          intervalsOverlap(data.startTime, data.endTime, b.startTime, b.endTime)
        );

        if (conflict) {
          throw new BookingApiError(`Já existe uma reserva que se sobrepõe a esse horário em ${d}.`, 409);
        }

        const booking = await tx.booking.create({
          data: {
            roomId: data.roomId,
            roomName,
            userName: auth.user.name,
            userEmail: loggedEmailNorm,
            participantsEmails: participantsNorm,
            date: d,
            startTime: data.startTime,
            endTime: data.endTime,
            title: data.title,
            longReason,
          },
        });
        rows.push(booking);
      }
      return rows;
    });

    await sendBookingEmailSafely("created", created[0] as BookingLike);
    await notifyBookingSafely("created", created[0] as BookingLike);
    await createAuditLog(req, auth.user, {
      action: "bookings.created",
      category: "bookings",
      targetType: "booking",
      targetId: created[0].id,
      targetLabel: created[0].title,
      metadata: {
        roomName: created[0].roomName,
        date: created[0].date,
        startTime: created[0].startTime,
        endTime: created[0].endTime,
        occurrences: created.length,
        participantsCount: uniq.length,
      },
    });

    return NextResponse.json(toBookingDto(created[0], auth.user), {
      status: 201,
      headers: { "X-Created-Count": String(created.length) },
    });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof BookingApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      const msg = err.issues[0]?.message || "Dados inválidos.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao criar reserva." }, { status: 500 });
  }
}

// -------------------- PATCH -------------------- //

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
    const loggedEmailNorm = auth.user.email;
    const isAdmin = auth.user.role === "admin";

    const rl = rateLimit(`booking:update:${loggedEmailNorm}`, 10, 60_000);
    if (!rl.ok) {
      return retryAfterResponse("Muitas alterações em pouco tempo.", rl.resetAt);
    }

    const json = await req.json();

    if (
      Object.prototype.hasOwnProperty.call(json, "participantsEmails") ||
      Object.prototype.hasOwnProperty.call(json, "title") ||
      Object.prototype.hasOwnProperty.call(json, "longReason")
    ) {
      const data = participantsUpdateSchema.parse(json);
      const booking = await prisma.booking.findUnique({ where: { id: data.id } });
      if (!booking) return NextResponse.json({ error: "Reserva nÃ£o encontrada." }, { status: 404 });

      if (!isAdmin && normEmail(booking.userEmail) !== loggedEmailNorm) {
        return NextResponse.json(
          { error: "Voce nao pode editar convidados de uma reserva de outro usuario." },
          { status: 403 }
        );
      }

      const ownerEmail = normEmail(booking.userEmail);
      const hasParticipantsInput = Object.prototype.hasOwnProperty.call(data, "participantsEmails");
      const previousParticipants = participantList(booking.participantsEmails);
      const nextParticipants = hasParticipantsInput
        ? Array.from(new Set(splitEmails(data.participantsEmails ?? ""))).filter((email) => email !== ownerEmail)
        : previousParticipants;
      const nextParticipantsText = nextParticipants.length ? nextParticipants.join(",") : null;
      const removed = previousParticipants.filter((email) => !nextParticipants.includes(email));
      const added = nextParticipants.filter((email) => !previousParticipants.includes(email));
      const titleChanged = typeof data.title === "string" && data.title.trim() !== booking.title;

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          participantsEmails: nextParticipantsText,
          ...(typeof data.title === "string" ? { title: data.title.trim() } : {}),
          ...(Object.prototype.hasOwnProperty.call(data, "longReason")
            ? { longReason: data.longReason?.trim() || null }
            : {}),
        },
      });

      for (const email of removed) {
        await sendParticipantEmailSafely("canceled", updated as BookingLike, email);
        await createBookingNotificationSafely("canceled", "participant", updated as BookingLike, email);
      }

      for (const email of added) {
        await sendParticipantEmailSafely("created", updated as BookingLike, email);
        await createBookingNotificationSafely("created", "participant", updated as BookingLike, email);
      }

      if (titleChanged) {
        await sendBookingEmailSafely("updated", updated as BookingLike);
        await createBookingNotificationSafely("updated", "owner", updated as BookingLike, updated.userEmail);
        const alreadyInvited = nextParticipants.filter((email) => !added.includes(email));
        for (const email of alreadyInvited) {
          await createBookingNotificationSafely("updated", "participant", updated as BookingLike, email);
        }
      }

      await createAuditLog(req, auth.user, {
        action: "bookings.details_updated",
        category: "bookings",
        targetType: "booking",
        targetId: updated.id,
        targetLabel: updated.title,
        metadata: {
          roomName: updated.roomName,
          date: updated.date,
          startTime: updated.startTime,
          endTime: updated.endTime,
          addedParticipants: added.length,
          removedParticipants: removed.length,
          titleChanged,
          longReasonChanged: Object.prototype.hasOwnProperty.call(data, "longReason"),
        },
      });

      return NextResponse.json(toBookingDto(updated, auth.user));
    }

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

    const isPersonalAgenda = booking.roomId === MY_AGENDA_ID;

    const updated = await prisma.$transaction(async (tx) => {
      await lockBookingDay(tx, booking.roomId, data.date, isPersonalAgenda ? normEmail(booking.userEmail) : undefined);
      await lockBookingDay(tx, "user-calendar", data.date, normEmail(booking.userEmail));
      await assertUserHasNoOverlappingBooking(tx, {
        email: booking.userEmail,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        excludeBookingId: booking.id,
      });

      const sameDay = await tx.booking.findMany({
        where: isPersonalAgenda
          ? { roomId: booking.roomId, date: data.date, userEmail: booking.userEmail, NOT: { id: booking.id } }
          : { roomId: booking.roomId, date: data.date, NOT: { id: booking.id } },
      });

      const conflict = sameDay.some((b) =>
        intervalsOverlap(data.startTime, data.endTime, b.startTime, b.endTime)
      );
      if (conflict) {
        throw new BookingApiError("Já existe uma reserva que se sobrepõe a esse horário.", 409);
      }

      return tx.booking.update({
        where: { id: booking.id },
        data: { date: data.date, startTime: data.startTime, endTime: data.endTime },
      });
    });

    await sendBookingEmailSafely("updated", updated as BookingLike);
    await notifyBookingSafely("updated", updated as BookingLike);
    await createAuditLog(req, auth.user, {
      action: "bookings.rescheduled",
      category: "bookings",
      severity: "warning",
      targetType: "booking",
      targetId: updated.id,
      targetLabel: updated.title,
      metadata: {
        roomName: updated.roomName,
        previousDate: booking.date,
        previousStartTime: booking.startTime,
        previousEndTime: booking.endTime,
        date: updated.date,
        startTime: updated.startTime,
        endTime: updated.endTime,
      },
    });
    return NextResponse.json(toBookingDto(updated, auth.user));
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof BookingApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      const msg = err.issues[0]?.message || "Dados inválidos.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao remarcar reserva." }, { status: 500 });
  }
}

// -------------------- DELETE -------------------- //

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
    const loggedEmailNorm = auth.user.email;
    const isAdmin = auth.user.role === "admin";

    const rl = rateLimit(`booking:delete:${loggedEmailNorm}`, 10, 60_000);
    if (!rl.ok) {
      return retryAfterResponse("Muitas exclusões em pouco tempo.", rl.resetAt);
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
    await sendBookingEmailSafely("canceled", booking as BookingLike);
    await notifyBookingSafely("canceled", booking as BookingLike);
    await createAuditLog(req, auth.user, {
      action: "bookings.deleted",
      category: "bookings",
      severity: "critical",
      targetType: "booking",
      targetId: booking.id,
      targetLabel: booking.title,
      metadata: {
        roomName: booking.roomName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      const msg = err.issues[0]?.message || "Dados inválidos.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao excluir reserva." }, { status: 500 });
  }
}
