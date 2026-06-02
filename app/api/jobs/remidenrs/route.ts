import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendBookingEmail, type BookingLike } from "@/lib/mail";

function buildStartDateTime(booking: { date: string; startTime: string }) {
  return new Date(`${booking.date}T${booking.startTime}:00`);
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
  const nowPlus15 = new Date(now.getTime() + 15 * 60 * 1000);

  const candidates = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      reminderSent: false,
    },
  });

  const toRemind = candidates.filter((b) => {
    const start = buildStartDateTime(b);
    return start > now && start <= nowPlus15;
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
  });
}

export async function GET(req: NextRequest) {
  return runReminderJob(req);
}

export async function POST(req: NextRequest) {
  return runReminderJob(req);
}
