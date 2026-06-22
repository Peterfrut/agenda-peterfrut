import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { LATEST_RELEASE_NOTE } from "@/lib/release-notes";
import { splitEmails } from "@/lib/formatters";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
  markReleaseSeen: z.boolean().optional(),
});

const bookingRequestInclude = {
  requester: { select: { name: true, email: true } },
  booking: {
    select: {
      title: true,
      roomName: true,
      date: true,
      startTime: true,
      endTime: true,
      userName: true,
      userEmail: true,
      participantsEmails: true,
    },
  },
} satisfies Prisma.BookingChangeRequestInclude;

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  metadata: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
};

type BookingRequestWithDetails = Prisma.BookingChangeRequestGetPayload<{
  include: typeof bookingRequestInclude;
}>;

type NotificationUser = {
  id: string;
  email: string;
};

function extractQuotedTitle(message: string) {
  const match = message.match(/"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

function dateWindow(date: Date, minutes = 10): Prisma.DateTimeFilter {
  return {
    gte: new Date(date.getTime() - minutes * 60_000),
    lte: new Date(date.getTime() + minutes * 60_000),
  };
}

function requestMetadata(
  request: BookingRequestWithDetails,
  params: { summary: string; statusLabel?: string }
) {
  const participants = splitEmails(request.booking.participantsEmails ?? "");
  const details = [
    { label: "Solicitante", value: `${request.requester.name} (${request.requester.email})` },
    { label: "Titulo", value: request.booking.title || "Agendamento" },
    { label: "Sala", value: request.booking.roomName },
    {
      label: "Horario da reuniao",
      value: `${request.booking.date} das ${request.booking.startTime} as ${request.booking.endTime}`,
    },
    { label: "Quem agendou", value: `${request.booking.userName} (${request.booking.userEmail})` },
  ];

  if (request.requestedDate && request.requestedStartTime && request.requestedEndTime) {
    details.push({
      label: "Novo horario sugerido",
      value: `${request.requestedDate} das ${request.requestedStartTime} as ${request.requestedEndTime}`,
    });
  }

  if (params.statusLabel) {
    details.push({ label: "Status", value: params.statusLabel });
  }

  details.push({ label: "Observacao", value: request.description });

  return {
    description: params.summary,
    details,
    participants,
  };
}

async function findBookingRequestFallback(
  notification: NotificationRow,
  user: NotificationUser
) {
  const quotedTitle = extractQuotedTitle(notification.message);
  const bookingTitleFilter = quotedTitle
    ? { title: { equals: quotedTitle, mode: "insensitive" as const } }
    : {};
  const ownerBookingFilter = {
    userEmail: { equals: user.email, mode: "insensitive" as const },
    ...bookingTitleFilter,
  };
  const aroundCreatedAt = dateWindow(notification.createdAt, 30);

  const baseWhereByType: Record<string, Prisma.BookingChangeRequestWhereInput | undefined> = {
    booking_request_created: {
      type: "reschedule",
      createdAt: aroundCreatedAt,
      booking: ownerBookingFilter,
    },
    booking_guest_declined: {
      type: "decline",
      createdAt: aroundCreatedAt,
      booking: ownerBookingFilter,
    },
    booking_decline_confirmed: {
      type: "decline",
      requesterId: user.id,
      createdAt: aroundCreatedAt,
      booking: bookingTitleFilter,
    },
    booking_request_rejected: {
      type: "reschedule",
      requesterId: user.id,
      OR: [{ resolvedAt: aroundCreatedAt }, { updatedAt: aroundCreatedAt }],
      booking: bookingTitleFilter,
    },
    booking_request_approved: {
      type: "reschedule",
      requesterId: user.id,
      OR: [{ resolvedAt: aroundCreatedAt }, { updatedAt: aroundCreatedAt }],
      booking: bookingTitleFilter,
    },
  };

  const where = baseWhereByType[notification.type];
  if (!where) return null;

  let request = await prisma.bookingChangeRequest.findFirst({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: bookingRequestInclude,
  });

  if (!request && quotedTitle) {
    const relaxedWhere: Prisma.BookingChangeRequestWhereInput = { ...where };
    delete relaxedWhere.booking;

    request = await prisma.bookingChangeRequest.findFirst({
      where: relaxedWhere,
      orderBy: [{ createdAt: "desc" }],
      include: bookingRequestInclude,
    });
  }

  return request;
}

async function fallbackMetadataForNotification(notification: NotificationRow, user: NotificationUser) {
  if (notification.metadata) return notification.metadata;

  const request = await findBookingRequestFallback(notification, user);
  if (!request) return null;

  if (notification.type === "booking_request_created") {
    return requestMetadata(request, {
      summary: `${request.requester.name} solicitou remarcacao desta reuniao.`,
      statusLabel: "Pendente",
    });
  }

  if (notification.type === "booking_guest_declined") {
    return requestMetadata(request, {
      summary: `${request.requester.name} informou que nao vai comparecer nesta reuniao.`,
      statusLabel: "Ausencia registrada",
    });
  }

  if (notification.type === "booking_decline_confirmed") {
    return requestMetadata(request, {
      summary: "Voce informou que nao vai comparecer e foi removido dos convidados desta reuniao.",
      statusLabel: "Ausencia registrada",
    });
  }

  if (notification.type === "booking_request_rejected") {
    return requestMetadata(request, {
      summary: "O responsavel rejeitou sua sugestao; o horario original continua valendo.",
      statusLabel: "Rejeitada",
    });
  }

  if (notification.type === "booking_request_approved") {
    return requestMetadata(request, {
      summary: "O responsavel aceitou sua sugestao como aviso, mas a reserva so muda quando ele editar o agendamento.",
      statusLabel: "Aceita",
    });
  }

  return null;
}

async function enrichNotificationsWithFallbackMetadata(notifications: NotificationRow[], user: NotificationUser) {
  return Promise.all(
    notifications.map(async (notification) => ({
      ...notification,
      metadata: await fallbackMetadataForNotification(notification, user),
    }))
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        href: true,
        metadata: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId: auth.user.id, readAt: null },
    }),
  ]);

  const latestPublishedAt = new Date(LATEST_RELEASE_NOTE.publishedAt);
  const hasUnreadRelease =
    !auth.user.lastSeenReleaseAt || auth.user.lastSeenReleaseAt < latestPublishedAt;
  const notificationsWithMetadata = await enrichNotificationsWithFallbackMetadata(notifications, auth.user);

  return NextResponse.json({
    ok: true,
    notifications: notificationsWithMetadata,
    unreadCount,
    latestRelease: LATEST_RELEASE_NOTE,
    hasUnreadRelease,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Dados invalidos." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const now = new Date();

  if (data.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: auth.user.id, readAt: null },
      data: { readAt: now },
    });
  } else if (data.id) {
    await prisma.notification.updateMany({
      where: { id: data.id, userId: auth.user.id, readAt: null },
      data: { readAt: now },
    });
  }

  if (data.markReleaseSeen) {
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { lastSeenReleaseAt: new Date(LATEST_RELEASE_NOTE.publishedAt) },
    });
  }

  return NextResponse.json({ ok: true });
}
