import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DateTime } from "luxon";
import {
  getTeamsUrlForRoom,
  sendBookingEmail,
  type BookingLike,
} from "@/lib/mail";
import { createNotificationForEmail } from "@/lib/notifications";
import { splitEmails } from "@/lib/formatters";

const REMINDER_WINDOW_MINUTES = 10;
const APP_TIME_ZONE = "America/Sao_Paulo";

function buildStartDateTime(booking: { date: string; startTime: string }) {
  const start = DateTime.fromISO(`${booking.date}T${booking.startTime}:00`, {
    zone: APP_TIME_ZONE,
  });

  return start.isValid ? start.toJSDate() : null;
}

function reminderHref(booking: BookingLike) {
  return getTeamsUrlForRoom(booking.roomId) || null;
}

function reminderMetadata(booking: BookingLike) {
  const title = booking.title?.trim() || "Agendamento";
  const participants = splitEmails(booking.participantsEmails ?? "");
  const details = [
    { label: "Titulo", value: title },
    { label: "Sala", value: booking.roomName },
    { label: "Data", value: booking.date },
    { label: "Horario da reuniao", value: `${booking.startTime} as ${booking.endTime}` },
    { label: "Quem agendou", value: `${booking.userName} (${booking.userEmail})` },
  ];

  return {
    description: "A reuniao comeca em breve.",
    details,
    participants,
  };
}

async function notifyReminder(booking: BookingLike) {
  const title = booking.title?.trim() || "Agendamento";
  const href = reminderHref(booking);
  const message = `"${title}" em ${booking.roomName} comeca em breve, hoje das ${booking.startTime} as ${booking.endTime}.`;

  const recipients = Array.from(
    new Set([booking.userEmail, ...splitEmails(booking.participantsEmails ?? "")])
  );

  for (const email of recipients) {
    try {
      await createNotificationForEmail(email, {
        type: "booking_reminder",
        title: "Lembrete de agendamento",
        message,
        href,
        metadata: reminderMetadata(booking),
      });
    } catch (err) {
      console.error("[REMINDER JOB] Falha ao criar notificacao para", email, err);
    }
  }
}

function isAuthorizedCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || cronHeader === secret;
}

async function runReminderJob(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, message: "Sem permissão" }, { status: 403 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000);

  const candidates = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      reminderSent: false,
    },
  });

  const toRemind = candidates.filter((b) => {
    const start = buildStartDateTime(b);
    return !!start && start > now && start <= windowEnd;
  });

  let reminded = 0;

  for (const b of toRemind) {
    try {
      const claimed = await prisma.booking.updateMany({
        where: { id: b.id, reminderSent: false },
        data: { reminderSent: true },
      });
      if (claimed.count === 0) continue;

      await sendBookingEmail("reminder", b as BookingLike);
      await notifyReminder(b as BookingLike);
      reminded++;
    } catch (err) {
      console.error("[REMINDER JOB] Falha ao enviar lembrete para", b.id, err);
      await prisma.booking.update({
        where: { id: b.id },
        data: { reminderSent: false },
      }).catch(() => undefined);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: candidates.length,
    reminded,
    windowMinutes: REMINDER_WINDOW_MINUTES,
  });
}

export async function GET(req: NextRequest) {
  return runReminderJob(req);
}

export async function POST(req: NextRequest) {
  return runReminderJob(req);
}
