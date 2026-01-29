import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendBookingEmail, type BookingLike } from "@/lib/mail";

function buildStartDateTime(booking: { date: string; startTime: string }) {
  return new Date(`${booking.date}T${booking.startTime}:00`);
}

export async function GET() {
  const now = new Date();
  const nowPlus15 = new Date(now.getTime() + 15 * 60 * 1000);

  // Pega reservas pendentes que ainda não receberam lembrete
  const candidates = await prisma.booking.findMany({
    where: {
      status: "pending",
      reminderSent: false,
    },
  });

  const toRemind = candidates.filter((b) => {
    const start = buildStartDateTime(b);
    return start > now && start <= nowPlus15;
  });

  for (const b of toRemind) {
    try {
      await sendBookingEmail("reminder", b as BookingLike);

      await prisma.booking.update({
        where: { id: b.id },
        data: { reminderSent: true },
      });
    } catch (err) {
      console.error("[REMINDER JOB] Falha ao enviar lembrete para", b.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: candidates.length,
    reminded: toRemind.length,
  });
}
