// app/api/import/route.ts
import { NextResponse, NextRequest } from "next/server";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { ROOMS, PERSONAL_ROOM_ID } from "@/lib/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ICS_BYTES = 5 * 1024 * 1024;
const MAX_EVENTS_PER_IMPORT = 5000;

type IcsAttendee =
  | string
  | {
      params?: Record<string, unknown>;
      val?: unknown;
    };

type IcsEvent = {
  type?: unknown;
  start?: unknown;
  end?: unknown;
  uid?: unknown;
  recurrenceid?: unknown;
  summary?: unknown;
  attendee?: unknown;
  description?: unknown;
};

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toSaoPaulo(dt: Date) {
  const sp = DateTime.fromJSDate(dt, { zone: "utc" }).setZone("America/Sao_Paulo");
  return { date: sp.toISODate()!, time: sp.toFormat("HH:mm") };
}

function getExternalIdForEvent(item: IcsEvent): { uid: string; externalId: string } {
  const uid = toText(item.uid);

  const rec =
    item.recurrenceid instanceof Date
      ? item.recurrenceid.toISOString()
      : typeof item.recurrenceid === "string"
        ? item.recurrenceid
        : null;

  const startIso = item.start instanceof Date ? item.start.toISOString() : "";
  const instanceKey = rec && rec.length > 0 ? rec : startIso;

  const externalId = instanceKey ? `${uid}#${instanceKey}` : uid;
  return { uid, externalId };
}

function normalizeAttendees(attendee: unknown): IcsAttendee[] {
  if (Array.isArray(attendee)) return attendee as IcsAttendee[];
  if (attendee) return [attendee as IcsAttendee];
  return [];
}

function extractAttendeeEmail(attendee: IcsAttendee) {
  const val = typeof attendee === "string" ? attendee : toText(attendee.val ?? attendee);
  const email = val.toLowerCase().startsWith("mailto:") ? val.slice(7) : val;
  return email.includes("@") ? email.trim().toLowerCase() : null;
}

function extractResponsible(item: IcsEvent): {
  userName: string;
  userEmail: string;
  participantsEmails: string | null;
} {
  const participants: string[] = [];

  const summary = toText(item.summary);
  const summaryNameMatch = summary.match(/\(([^)]+)\)\s*$/);
  const nameFromSummary = summaryNameMatch?.[1]?.trim() || null;

  let bestEmail: string | null = null;
  let bestCn: string | null = null;

  for (const attendee of normalizeAttendees(item.attendee)) {
    const params = typeof attendee === "string" ? {} : attendee.params ?? {};
    const cutype = toText(params.CUTYPE).toUpperCase();
    const cn = toText(params.CN);
    const email = extractAttendeeEmail(attendee);

    if (email) participants.push(email);

    if (!bestEmail && cutype === "INDIVIDUAL" && email) {
      bestEmail = email;
      bestCn = cn || null;
    }
  }

  const desc = toText(item.description);
  let nameFromDesc: string | null = null;
  if (desc) {
    const m =
      desc.match(/Respons[aá]vel:\s*(.+)/i) ||
      desc.match(/Organizador:\s*(.+)/i) ||
      desc.match(/Criado por:\s*(.+)/i);
    if (m?.[1]) nameFromDesc = m[1].trim();
  }

  const userName = nameFromSummary || bestCn || nameFromDesc || "Reservado";
  const userEmail = bestEmail || "unknown@import.local";

  const uniqueParticipants = Array.from(
    new Set(participants.filter((p) => p && p !== "unknown@import.local"))
  );

  return {
    userName,
    userEmail,
    participantsEmails: uniqueParticipants.length ? uniqueParticipants.join(",") : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const form = await req.formData();
    const roomId = toText(form.get("roomId"));
    const file = form.get("file");
    const strategy = toText(form.get("strategy")) || "replace";
    const batchSizeRaw = Number(form.get("batchSize") ?? 500);
    const batchSize = Number.isFinite(batchSizeRaw)
      ? Math.min(1000, Math.max(1, Math.floor(batchSizeRaw)))
      : 500;

    const room = ROOMS.find((r) => r.id === roomId && r.id !== PERSONAL_ROOM_ID);
    if (!room) return NextResponse.json({ ok: false, message: "Sala inválida" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "Arquivo .ics obrigatório" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".ics")) {
      return NextResponse.json({ ok: false, message: "O arquivo precisa ser .ics" }, { status: 400 });
    }
    if (file.size > MAX_ICS_BYTES) {
      return NextResponse.json({ ok: false, message: "Arquivo .ics muito grande. Limite: 5 MB." }, { status: 413 });
    }
    if (!["replace", "append"].includes(strategy)) {
      return NextResponse.json({ ok: false, message: "Estratégia inválida" }, { status: 400 });
    }

    const text = await file.text();
    const ical = await import("node-ical");
    const parsed = ical.sync.parseICS(text) as Record<string, IcsEvent>;

    const externalSource = /X-WR-CALNAME:(.+)\r?\n/i.exec(text)?.[1]?.trim() ?? null;
    const roomName = room.name;

    const toInsert: Array<{
      provider: "ics";
      externalId: string;
      externalSource: string | null;
      roomId: string;
      roomName: string;
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      status: "confirmed";
      userName: string;
      userEmail: string;
      participantsEmails: string | null;
    }> = [];
    let skipped = 0;
    let crossDaySkipped = 0;
    let noUidSkipped = 0;
    let limitSkipped = 0;

    for (const item of Object.values(parsed)) {
      if (!item || item.type !== "VEVENT") continue;
      if (toInsert.length >= MAX_EVENTS_PER_IMPORT) {
        limitSkipped++;
        continue;
      }

      if (!(item.start instanceof Date) || !(item.end instanceof Date)) {
        skipped++;
        continue;
      }

      const { uid, externalId } = getExternalIdForEvent(item);
      if (!uid || !externalId) {
        noUidSkipped++;
        continue;
      }

      const start = toSaoPaulo(item.start);
      const end = toSaoPaulo(item.end);
      if (start.date !== end.date) {
        crossDaySkipped++;
        continue;
      }

      const title = toText(item.summary) || "Evento";
      const { userName, userEmail, participantsEmails } = extractResponsible(item);

      toInsert.push({
        provider: "ics",
        externalId,
        externalSource,
        roomId,
        roomName,
        title,
        date: start.date,
        startTime: start.time,
        endTime: end.time,
        status: "confirmed",
        userName,
        userEmail,
        participantsEmails,
      });
    }

    const deduped = Array.from(new Map(toInsert.map((x) => [`${x.provider}:${x.roomId}:${x.externalId}`, x])).values());
    const duplicatesRemoved = toInsert.length - deduped.length;

    if (strategy === "replace") {
      await prisma.booking.deleteMany({ where: { provider: "ics", roomId } });
    }

    let inserted = 0;
    for (let i = 0; i < deduped.length; i += batchSize) {
      const batch = deduped.slice(i, i + batchSize);
      const result = await prisma.booking.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
    }

    return NextResponse.json({
      ok: true,
      message: "Importação concluída",
      strategy,
      roomName,
      externalSource,
      totalParsed: toInsert.length,
      inserted,
      duplicatesRemoved,
      skipped,
      crossDaySkipped,
      noUidSkipped,
      limitSkipped,
    });
  } catch (e: unknown) {
    console.error("ICS import failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Erro ao importar ICS" },
      { status: 500 }
    );
  }
}
