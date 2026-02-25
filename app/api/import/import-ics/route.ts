// app/api/admin/import-ics/route.ts
import { NextResponse, NextRequest } from "next/server";
import * as ical from "node-ical";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import { verifyJwt } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoggedUser = {
  email: string;
  role?: string;
};

function getLoggedUser(req: NextRequest): LoggedUser {
  const token = req.cookies.get("token")?.value ?? "";
  if (!token) return { email: "", role: undefined };

  const payload: any = verifyJwt(token);
  return { email: payload?.email ?? "", role: payload?.role };
}

function toSaoPaulo(dt: Date) {
  const sp = DateTime.fromJSDate(dt, { zone: "utc" }).setZone("America/Sao_Paulo");
  return {
    date: sp.toISODate()!,       // YYYY-MM-DD
    time: sp.toFormat("HH:mm"),  // HH:mm
  };
}

/**
 * Resolve colisões de UID em recorrência:
 * - Se tiver RECURRENCE-ID, usa UID#RECURRENCE-ID
 * - Senão usa UID#DTSTART
 */
function getExternalIdForEvent(item: any): { uid: string; externalId: string } {
  const uid = String(item?.uid ?? "").trim();

  const rec =
    item?.recurrenceid instanceof Date
      ? item.recurrenceid.toISOString()
      : typeof item?.recurrenceid === "string"
        ? item.recurrenceid
        : null;

  const startIso = item?.start instanceof Date ? item.start.toISOString() : "";
  const instanceKey = rec && rec.length > 0 ? rec : startIso;

  const externalId = instanceKey ? `${uid}#${instanceKey}` : uid;
  return { uid, externalId };
}

/**
 * Responsável:
 * 1) Primeiro ATTENDEE INDIVIDUAL (CN / mailto)
 * 2) Fallback: "(Nome)" no fim do SUMMARY
 * 3) Fallback: "Responsável:" / "Organizador:" no DESCRIPTION
 * 4) Fallback final: "Reservado"
 *
 * Observação: não usamos ORGANIZER como default porque normalmente é a conta da sala.
 */
function extractResponsible(item: any): {
  userName: string;
  userEmail: string;
  participantsEmails: string | null;
} {
  const attendeesRaw = item?.attendee;
  const attendeesArr = Array.isArray(attendeesRaw)
    ? attendeesRaw
    : attendeesRaw
      ? [attendeesRaw]
      : [];

  const participants: string[] = [];

  let bestName: string | null = null;
  let bestEmail: string | null = null;

  for (const a of attendeesArr) {
    const params = a?.params ?? {};
    const cutype = String(params?.CUTYPE ?? "").toUpperCase();
    const cn = String(params?.CN ?? "").trim();

    const val = String(a?.val ?? a ?? "").trim();
    const email = val.toLowerCase().startsWith("mailto:") ? val.slice(7) : val;
    const emailClean = email.includes("@") ? email : null;

    if (emailClean) participants.push(emailClean);

    if (!bestEmail && cutype === "INDIVIDUAL" && (cn || emailClean)) {
      bestName = cn || null;
      bestEmail = emailClean;
    }
  }

  const summary = String(item?.summary ?? "").trim();
  if (!bestName && summary) {
    const m = summary.match(/\(([^)]+)\)\s*$/);
    if (m?.[1]) bestName = m[1].trim();
  }

  const desc = String(item?.description ?? "").trim();
  if (!bestName && desc) {
    const m =
      desc.match(/Respons[aá]vel:\s*(.+)/i) ||
      desc.match(/Organizador:\s*(.+)/i) ||
      desc.match(/Criado por:\s*(.+)/i);

    if (m?.[1]) bestName = m[1].trim();
  }

  const userName = bestName || "Reservado";
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
    const me = getLoggedUser(req);

    if (!me?.email) {
      return NextResponse.json({ ok: false, message: "Não autenticado" }, { status: 401 });
    }
    if (me.role !== "admin") {
      return NextResponse.json({ ok: false, message: "Sem permissão" }, { status: 403 });
    }

    const form = await req.formData();
    const roomId = String(form.get("roomId") ?? "").trim();
    const file = form.get("file");
    const strategy = String(form.get("strategy") ?? "replace"); // replace | merge
    const batchSize = Number(form.get("batchSize") ?? 500);

    if (!roomId) {
      return NextResponse.json({ ok: false, message: "roomId obrigatório" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Arquivo .ics obrigatório" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = ical.sync.parseICS(text);

    const externalSource =
      /X-WR-CALNAME:(.+)\r?\n/i.exec(text)?.[1]?.trim() ?? null;

    // Como suas salas vêm do lib/rooms.ts, não temos nome no banco.
    // Se quiser, envie roomName no formData e use aqui.
    const roomName = `Sala ${roomId}`;

    const toInsert: any[] = [];

    let skipped = 0;
    let crossDaySkipped = 0;
    let noUidSkipped = 0;

    for (const key of Object.keys(parsed)) {
      const item: any = (parsed as any)[key];
      if (!item || item.type !== "VEVENT") continue;

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

      // Simplificação: ignora eventos que cruzam o dia
      if (start.date !== end.date) {
        crossDaySkipped++;
        continue;
      }

      const title = String(item.summary ?? "Evento").trim();
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

    // Dedup por provider+externalId
    const deduped = Array.from(
      new Map(toInsert.map((x) => [`${x.provider}:${x.externalId}`, x])).values()
    );

    const duplicatesRemoved = toInsert.length - deduped.length;

    if (strategy === "replace") {
      await prisma.booking.deleteMany({
        where: { provider: "ics", roomId },
      });
    }

    let inserted = 0;
    const size = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 500;

    for (let i = 0; i < deduped.length; i += size) {
      const batch = deduped.slice(i, i + size);

      const result = await prisma.booking.createMany({
        data: batch,
        skipDuplicates: true,
      });

      inserted += result.count;
    }

    return NextResponse.json({
      ok: true,
      strategy,
      externalSource,
      totalParsed: toInsert.length,
      inserted,
      duplicatesRemoved,
      skipped,
      crossDaySkipped,
      noUidSkipped,
    });
  } catch (e: any) {
    console.error("ICS import failed:", e);
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Erro ao importar ICS" },
      { status: 500 }
    );
  }
}