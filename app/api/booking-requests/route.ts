import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { Booking, Prisma } from "@prisma/client";
import { requireUser, type SessionUser } from "@/lib/api-auth";
import { isWithinWorkingHours } from "@/lib/time";
import { isStep30Minutes, normEmail, splitEmails } from "@/lib/formatters";
import { rateLimit } from "@/lib/rate-limit";
import { retryAfterResponse } from "@/lib/security";
import { createNotification, createNotificationForEmail } from "@/lib/notifications";
import { sendBookingParticipantEmail, type BookingLike } from "@/lib/mail";
import { createAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createRequestSchema = z.object({
  bookingId: z.string().min(1),
  type: z.enum(["reschedule", "decline"]),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  requestedStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  requestedEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  description: z.string().trim().min(5).max(500),
});

const resolveRequestSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

function participantList(value: string | null) {
  return splitEmails(value ?? "");
}

function canManageBooking(booking: Pick<Booking, "userEmail">, user: SessionUser) {
  return user.role === "admin" || normEmail(booking.userEmail) === user.email;
}

function isParticipant(booking: Pick<Booking, "participantsEmails">, email: string) {
  return participantList(booking.participantsEmails).includes(normEmail(email));
}

async function sendParticipantEmailSafely(kind: "canceled", booking: BookingLike, email: string) {
  try {
    await sendBookingParticipantEmail(kind, booking, email);
  } catch (err) {
    console.error(`[BOOKING REQUEST MAIL] Falha ao enviar e-mail para ${email}.`, err);
  }
}

type BookingNotificationDetails = Pick<
  Booking,
  "title" | "roomName" | "date" | "startTime" | "endTime" | "userName" | "userEmail" | "participantsEmails"
>;

function bookingDetailsForNotification(booking: BookingNotificationDetails) {
  const participants = participantList(booking.participantsEmails);
  const details = [
    { label: "Titulo", value: booking.title || "Agendamento" },
    { label: "Sala", value: booking.roomName },
    { label: "Horario da reuniao", value: `${booking.date} das ${booking.startTime} as ${booking.endTime}` },
    { label: "Quem agendou", value: `${booking.userName} (${booking.userEmail})` },
  ];

  return { details, participants };
}

function requestNotificationMetadata(params: {
  booking: BookingNotificationDetails;
  requesterName: string;
  requesterEmail: string;
  description: string;
  requestedDate?: string | null;
  requestedStartTime?: string | null;
  requestedEndTime?: string | null;
  statusLabel?: string;
  summary: string;
}) {
  const bookingDetails = bookingDetailsForNotification(params.booking);
  const details = [
    { label: "Solicitante", value: `${params.requesterName} (${params.requesterEmail})` },
    ...bookingDetails.details,
  ];

  if (params.requestedDate && params.requestedStartTime && params.requestedEndTime) {
    details.push({
      label: "Novo horario sugerido",
      value: `${params.requestedDate} das ${params.requestedStartTime} as ${params.requestedEndTime}`,
    });
  }

  if (params.statusLabel) {
    details.push({ label: "Status", value: params.statusLabel });
  }

  details.push({ label: "Observacao", value: params.description });

  return {
    description: params.summary,
    details,
    participants: bookingDetails.participants,
  };
}

function requestDto(item: {
  id: string;
  type: string;
  status: string;
  requestedDate: string | null;
  requestedStartTime: string | null;
  requestedEndTime: string | null;
  description: string;
  requesterEmail: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  booking: Pick<Booking, "id" | "title" | "roomName" | "date" | "startTime" | "endTime" | "userName" | "userEmail">;
}) {
  return {
    id: item.id,
    type: item.type,
    status: item.status,
    requestedDate: item.requestedDate,
    requestedStartTime: item.requestedStartTime,
    requestedEndTime: item.requestedEndTime,
    description: item.description,
    requesterEmail: item.requesterEmail,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    resolvedAt: item.resolvedAt,
    booking: item.booking,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });

  const bookingSelect = {
    id: true,
    title: true,
    roomName: true,
    date: true,
    startTime: true,
    endTime: true,
    userName: true,
    userEmail: true,
  } satisfies Prisma.BookingSelect;

  const [sent, received] = await Promise.all([
    prisma.bookingChangeRequest.findMany({
      where: { requesterId: auth.user.id },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: { booking: { select: bookingSelect } },
    }),
    prisma.bookingChangeRequest.findMany({
      where: auth.user.role === "admin" ? undefined : { booking: { userEmail: auth.user.email } },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: { booking: { select: bookingSelect } },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    sent: sent.map(requestDto),
    received: received.map(requestDto),
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });

    const rl = rateLimit(`booking-request:create:${auth.user.id}`, 8, 60_000);
    if (!rl.ok) return retryAfterResponse("Muitas solicitacoes em pouco tempo.", rl.resetAt);

    const data = createRequestSchema.parse(await req.json());

    if (data.type === "reschedule") {
      if (!data.requestedDate || !data.requestedStartTime || !data.requestedEndTime) {
        return NextResponse.json({ ok: false, error: "Informe data e horario sugeridos." }, { status: 400 });
      }
      if (
        !isStep30Minutes(data.requestedStartTime) ||
        !isStep30Minutes(data.requestedEndTime) ||
        !isWithinWorkingHours(data.requestedStartTime, data.requestedEndTime)
      ) {
        return NextResponse.json({ ok: false, error: "Horario sugerido invalido." }, { status: 400 });
      }
    }

    const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
    if (!booking) return NextResponse.json({ ok: false, error: "Reserva nao encontrada." }, { status: 404 });

    if (canManageBooking(booking, auth.user)) {
      return NextResponse.json(
        { ok: false, error: "O responsavel pela reserva pode editar diretamente." },
        { status: 400 }
      );
    }

    if (!isParticipant(booking, auth.user.email)) {
      return NextResponse.json(
        { ok: false, error: "Apenas convidados desta reserva podem criar solicitacoes." },
        { status: 403 }
      );
    }

    if (data.type === "decline") {
      const requesterEmail = normEmail(auth.user.email);
      const result = await prisma.$transaction(async (tx) => {
        const nextParticipants = participantList(booking.participantsEmails).filter(
          (email) => email !== requesterEmail
        );

        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { participantsEmails: nextParticipants.length ? nextParticipants.join(",") : null },
        });

        const request = await tx.bookingChangeRequest.create({
          data: {
            bookingId: booking.id,
            requesterId: auth.user.id,
            requesterEmail: auth.user.email,
            type: data.type,
            description: data.description.trim(),
            status: "approved",
            resolvedAt: new Date(),
          },
          include: {
            booking: {
              select: {
                id: true,
                title: true,
                roomName: true,
                date: true,
                startTime: true,
                endTime: true,
                userName: true,
                userEmail: true,
              },
            },
          },
        });

        await tx.notification.create({
          data: {
            userId: auth.user.id,
            type: "booking_decline_confirmed",
            title: "Ausencia registrada",
            message: `Voce saiu da reserva "${booking.title}".`,
            href: "/notifications",
            metadata: requestNotificationMetadata({
              booking,
              requesterName: auth.user.name,
              requesterEmail: auth.user.email,
              description: data.description.trim(),
              statusLabel: "Ausencia registrada",
              summary: "Voce informou que nao vai comparecer e foi removido dos convidados desta reuniao.",
            }),
          },
        });

        return { updatedBooking, request };
      });

      await createNotificationForEmail(booking.userEmail, {
        type: "booking_guest_declined",
        title: "Convidado nao vai comparecer",
        message: `${auth.user.name} informou que nao vai comparecer em "${booking.title}".`,
        href: "/notifications",
        metadata: requestNotificationMetadata({
          booking,
          requesterName: auth.user.name,
          requesterEmail: auth.user.email,
          description: data.description.trim(),
          statusLabel: "Ausencia registrada",
          summary: `${auth.user.name} informou que nao vai comparecer nesta reuniao.`,
        }),
      });
      await sendParticipantEmailSafely("canceled", result.updatedBooking as BookingLike, requesterEmail);
      await createAuditLog(req, auth.user, {
        action: "requests.decline_created",
        category: "requests",
        targetType: "booking",
        targetId: booking.id,
        targetLabel: booking.title,
        metadata: {
          requestId: result.request.id,
          roomName: booking.roomName,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      });

      return NextResponse.json({ ok: true, request: requestDto(result.request) }, { status: 201 });
    }

    const existingPending = await prisma.bookingChangeRequest.findFirst({
      where: { bookingId: booking.id, requesterId: auth.user.id, status: "pending" },
      select: { id: true },
    });

    if (existingPending) {
      return NextResponse.json(
        { ok: false, error: "Voce ja possui uma solicitacao pendente para esta reserva." },
        { status: 409 }
      );
    }

    const created = await prisma.bookingChangeRequest.create({
      data: {
        bookingId: booking.id,
        requesterId: auth.user.id,
        requesterEmail: auth.user.email,
        type: data.type,
        requestedDate: data.type === "reschedule" ? data.requestedDate : null,
        requestedStartTime: data.type === "reschedule" ? data.requestedStartTime : null,
        requestedEndTime: data.type === "reschedule" ? data.requestedEndTime : null,
        description: data.description.trim(),
      },
      include: {
        booking: {
          select: {
            id: true,
            title: true,
            roomName: true,
            date: true,
            startTime: true,
            endTime: true,
            userName: true,
            userEmail: true,
          },
        },
      },
    });

    await createNotificationForEmail(booking.userEmail, {
      type: "booking_request_created",
      title: "Sugestao de remarcacao",
      message: `${auth.user.name} sugeriu remarcar "${booking.title}".`,
      href: "/notifications",
      metadata: requestNotificationMetadata({
        booking,
        requesterName: auth.user.name,
        requesterEmail: auth.user.email,
        description: data.description.trim(),
        requestedDate: data.requestedDate,
        requestedStartTime: data.requestedStartTime,
        requestedEndTime: data.requestedEndTime,
        statusLabel: "Pendente",
        summary: `${auth.user.name} sugeriu outro horario para esta reuniao.`,
      }),
    });
    await createAuditLog(req, auth.user, {
      action: "requests.reschedule_created",
      category: "requests",
      targetType: "booking",
      targetId: booking.id,
      targetLabel: booking.title,
      metadata: {
        requestId: created.id,
        roomName: booking.roomName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        requestedDate: data.requestedDate,
        requestedStartTime: data.requestedStartTime,
        requestedEndTime: data.requestedEndTime,
      },
    });

    return NextResponse.json({ ok: true, request: requestDto(created) }, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: err.issues[0]?.message || "Dados invalidos." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "Erro ao criar solicitacao." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });

    const rl = rateLimit(`booking-request:resolve:${auth.user.id}`, 20, 60_000);
    if (!rl.ok) return retryAfterResponse("Muitas alteracoes em pouco tempo.", rl.resetAt);

    const data = resolveRequestSchema.parse(await req.json());

    const request = await prisma.bookingChangeRequest.findUnique({
      where: { id: data.id },
      include: { booking: true },
    });

    if (!request) return NextResponse.json({ ok: false, error: "Solicitacao nao encontrada." }, { status: 404 });
    if (!canManageBooking(request.booking, auth.user)) {
      return NextResponse.json({ ok: false, error: "Sem permissao para responder esta solicitacao." }, { status: 403 });
    }
    if (request.status !== "pending") {
      return NextResponse.json({ ok: false, error: "Esta solicitacao ja foi respondida." }, { status: 409 });
    }

    if (data.action === "reject") {
      const updated = await prisma.bookingChangeRequest.update({
        where: { id: request.id },
        data: { status: "rejected", resolvedAt: new Date() },
        include: {
          booking: {
            select: {
              id: true,
              title: true,
              roomName: true,
              date: true,
              startTime: true,
              endTime: true,
              userName: true,
              userEmail: true,
            },
          },
        },
      });

      await createNotification(request.requesterId, {
        type: "booking_request_rejected",
        title: "Solicitacao rejeitada",
        message: `Sua solicitacao para "${request.booking.title}" foi rejeitada. O horario original continua valendo.`,
        href: "/notifications",
        metadata: requestNotificationMetadata({
          booking: request.booking,
          requesterName: request.requesterEmail,
          requesterEmail: request.requesterEmail,
          description: request.description,
          requestedDate: request.requestedDate,
          requestedStartTime: request.requestedStartTime,
          requestedEndTime: request.requestedEndTime,
          statusLabel: "Rejeitada",
          summary: "O responsavel rejeitou sua sugestao; o horario original continua valendo.",
        }),
      });
      await createAuditLog(req, auth.user, {
        action: "requests.rejected",
        category: "requests",
        severity: "warning",
        targetType: "booking_request",
        targetId: request.id,
        targetLabel: request.booking.title,
        metadata: {
          bookingId: request.bookingId,
          requesterEmail: request.requesterEmail,
        },
      });

      return NextResponse.json({ ok: true, request: requestDto(updated) });
    }

    if (request.type !== "reschedule") {
      return NextResponse.json(
        { ok: false, error: "Ausencias sao registradas automaticamente e nao exigem aprovacao." },
        { status: 400 }
      );
    }

    const updated = await prisma.bookingChangeRequest.update({
      where: { id: request.id },
      data: { status: "approved", resolvedAt: new Date() },
      include: {
        booking: {
          select: {
            id: true,
            title: true,
            roomName: true,
            date: true,
            startTime: true,
            endTime: true,
            userName: true,
            userEmail: true,
          },
        },
      },
    });

    await createNotification(request.requesterId, {
      type: "booking_request_approved",
      title: "Sugestao aceita",
      message: `O responsavel viu sua sugestao para "${request.booking.title}". A reserva original continua ate ele remarcar.`,
      href: "/notifications",
      metadata: requestNotificationMetadata({
        booking: request.booking,
        requesterName: request.requesterEmail,
        requesterEmail: request.requesterEmail,
        description: request.description,
        requestedDate: request.requestedDate,
        requestedStartTime: request.requestedStartTime,
        requestedEndTime: request.requestedEndTime,
        statusLabel: "Aceita",
        summary: "O responsavel aceitou sua sugestao como aviso, mas a reserva so muda quando ele editar o agendamento.",
      }),
    });
    await createAuditLog(req, auth.user, {
      action: "requests.approved",
      category: "requests",
      severity: "warning",
      targetType: "booking_request",
      targetId: request.id,
      targetLabel: request.booking.title,
      metadata: {
        bookingId: request.bookingId,
        requesterEmail: request.requesterEmail,
        requestedDate: request.requestedDate,
        requestedStartTime: request.requestedStartTime,
        requestedEndTime: request.requestedEndTime,
      },
    });

    return NextResponse.json({ ok: true, request: requestDto(updated) });
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: err.issues[0]?.message || "Dados invalidos." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "Erro ao responder solicitacao." }, { status: 500 });
  }
}
