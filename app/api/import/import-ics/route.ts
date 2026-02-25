import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTokenFromRequest, verifyJwt } from "@/lib/auth";
import { ROOMS, PERSONAL_ROOM_ID } from "@/lib/rooms";

import * as ical from "node-ical";
import { DateTime } from "luxon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSaoPaulo(dt: Date) {
  // Se o ICS usa "Z", dt vem como UTC. Se vier "floating", tratamos como UTC mesmo.
  return DateTime.fromJSDate(dt, { zone: "utc" }).setZone("America/Sao_Paulo");
}

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function extractOrganizer(item: any): { name: string | null; email: string | null } {
  // node-ical pode trazer organizer como string, objeto { val, params }, etc.
  const org = item?.organizer;
  if (!org) return { name: null, email: null };

  const name =
    (org?.params?.CN as string | undefined) ??
    (org?.cn as string | undefined) ??
    (typeof org === "string" ? null : null);

  let rawEmail: string | null =
    (typeof org === "string" ? org : null) ??
    (typeof org?.val === "string" ? org.val : null) ??
    (typeof org?.email === "string" ? org.email : null);

  if (rawEmail) rawEmail = rawEmail.replace(/^mailto:/i, "");

  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  return { name: name ? String(name).trim() : null, email };
}

function extractAttendeesEmails(item: any): string[] {
  const a = item?.attendee ?? item?.attendees;
  const out: string[] = [];

  const pushEmail = (v: any) => {
    if (!v) return;
    let raw: string | null =
      (typeof v === "string" ? v : null) ??
      (typeof v?.val === "string" ? v.val : null) ??
      (typeof v?.email === "string" ? v.email : null);
    if (!raw) return;
    raw = raw.replace(/^mailto:/i, "");
    const e = normalizeEmail(raw);
    if (e) out.push(e);
  };

  if (Array.isArray(a)) a.forEach(pushEmail);
  else if (a) pushEmail(a);

  // dedupe
  return Array.from(new Set(out));
}

function extractBestResponsible(item: any, sourceCalendar: string | null): { name: string | null; email: string | null } {
  // No ICS do Google, ORGANIZER geralmente é a própria agenda (sala/conta).
  // Quem criou/é responsável costuma aparecer como ATTENDEE com CUTYPE=INDIVIDUAL e CN.
  const org = extractOrganizer(item);

  const calendarHint = normalizeEmail(sourceCalendar);
  const organizerEmail = normalizeEmail(org.email);

  const attendees = item?.attendee ?? item?.attendees;
  const arr = Array.isArray(attendees) ? attendees : attendees ? [attendees] : [];

  // 1) Preferir attendee INDIVIDUAL com CN e email que não seja a própria agenda
  for (const a of arr) {
    const cutype = String(a?.params?.CUTYPE ?? a?.params?.cutype ?? "").toUpperCase();
    const cn = String(a?.params?.CN ?? a?.params?.cn ?? "").trim();
    let raw =
      (typeof a === "string" ? a : null) ??
      (typeof a?.val === "string" ? a.val : null) ??
      (typeof a?.email === "string" ? a.email : null);
    if (raw) raw = raw.replace(/^mailto:/i, "");
    const email = raw ? normalizeEmail(raw) : "";

    const isCalendarEmail = (calendarHint && email === calendarHint) || (organizerEmail && email === organizerEmail);
    const isIndividual = cutype === "INDIVIDUAL" || cutype === ""; // alguns exports não incluem CUTYPE

    if (isIndividual && !isCalendarEmail) {
      return {
        name: cn || null,
        email: email || null,
      };
    }
  }

  // 2) Fallback: usar nome no final do SUMMARY: "... (Nome)"
  const rawTitle = String(item?.summary ?? "").trim();
  const fallbackName = extractNameFromTrailingParentheses(rawTitle);
  if (fallbackName) {
    return { name: fallbackName, email: null };
  }

  // 3) Fallback: tentar extrair do DESCRIPTION
  const desc = String(item?.description ?? "");
  const m = /(?:respons[aá]vel|organizador|organizer|created by)\s*:\s*([^\n\r]+)/i.exec(desc);
  if (m?.[1]) {
    const n = m[1].trim();
    if (n) return { name: n, email: null };
  }

  // 4) Último fallback: se organizer tem nome que não pareça ser a agenda
  const organizerName = (org.name ?? "").trim();
  if (organizerName && organizerName.toLowerCase() !== (sourceCalendar ?? "").trim().toLowerCase()) {
    return org;
  }

  return { name: null, email: null };
}

function extractNameFromTrailingParentheses(title: string): string | null {
  const m = /\(([^)]+)\)\s*$/.exec(title);
  if (!m) return null;
  const name = m[1]?.trim();
  return name ? name : null;
}

function stripTrailingParentheses(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
}
async function requireAdmin(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return { ok: false as const, res: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };

  const payload = await verifyJwt(token);
  const role = (payload as any)?.role;
  if (!payload || role !== "admin") {
    return { ok: false as const, res: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  const form = await req.formData();
  const file = form.get("file");
  const roomId = String(form.get("roomId") ?? "");

  if (!roomId) {
    return NextResponse.json({ error: "roomId obrigatório." }, { status: 400 });
  }

  const room = ROOMS.find((r) => r.id === roomId);
  if (!room || roomId === PERSONAL_ROOM_ID) {
    return NextResponse.json({ error: "Sala inválida para importação." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo .ics (file) obrigatório." }, { status: 400 });
  }

  const text = await file.text();
  const parsed = ical.sync.parseICS(text);
  const sourceCalendar = /X-WR-CALNAME:(.+)\r?\n/i.exec(text)?.[1]?.trim() ?? null;

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ uid?: string; message: string }> = [];

  for (const key of Object.keys(parsed)) {
    const item: any = (parsed as any)[key];
    if (!item || item.type !== "VEVENT") continue;

    // Ignora entradas sem start/end
    if (!(item.start instanceof Date) || !(item.end instanceof Date)) {
      skipped++;
      continue;
    }

    const uid = String(item.uid ?? "").trim();
    if (!uid) {
      skipped++;
      continue;
    }

    try {
      const start = toSaoPaulo(item.start);
      const end = toSaoPaulo(item.end);

      // Se cruzar meia-noite, você pode optar por quebrar em 2 reservas.
      // Para manter simples e previsível, pulamos esses casos.
      if (start.toISODate() !== end.toISODate()) {
        skipped++;
        continue;
      }

      const date = start.toISODate()!; // YYYY-MM-DD
      const startTime = start.toFormat("HH:mm");
      const endTime = end.toFormat("HH:mm");

      const rawTitle = String(item.summary ?? "Evento").trim() || "Evento";

      const attendeesEmails = extractAttendeesEmails(item);
      const best = extractBestResponsible(item, sourceCalendar);
      const resolvedUserName = (best.name ?? "Reservado").trim();
      const resolvedUserEmail = best.email ?? (attendeesEmails[0] ?? "import@calendar.local");

      // Título: manter exatamente como veio do Google (o usuário pediu isso)
      const title = rawTitle;

      const participantsEmails = attendeesEmails.length ? attendeesEmails.join(",") : null;

      // Upsert por provider+externalId para evitar duplicar em reimportações
      const existing = await prisma.booking.findUnique({
        where: {
          provider_externalId: {
            provider: "ics",
            externalId: uid,
          },
        },
        select: { id: true },
      });

      await prisma.booking.upsert({
        where: {
          provider_externalId: {
            provider: "ics",
            externalId: uid,
          },
        },
        create: {
          provider: "ics",
          externalId: uid,
          externalSource: sourceCalendar,
          roomId,
          roomName: room.name,

          userName: resolvedUserName,
          userEmail: resolvedUserEmail,
          participantsEmails,

          title,
          date,
          startTime,
          endTime,
          status: "confirmed",
          reminderSent: true,
        },
        update: {
          externalSource: sourceCalendar,
          roomId,
          roomName: room.name,
          userName: resolvedUserName,
          userEmail: resolvedUserEmail,
          participantsEmails,
          title,
          date,
          startTime,
          endTime,
          status: "confirmed",
        },
      });

      if (existing) updated++;
      else imported++;
    } catch (e: any) {
      skipped++;
      errors.push({ uid, message: e?.message ?? "Erro ao processar VEVENT" });
    }
  }

  return NextResponse.json({
    ok: true,
    roomId,
    roomName: room.name,
    sourceCalendar,
    imported,
    updated,
    skipped,
    errors: errors.slice(0, 50),
  });
}
