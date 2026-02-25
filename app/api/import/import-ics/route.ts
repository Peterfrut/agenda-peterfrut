import { NextResponse } from "next/server";
import * as ical from "node-ical";
import { DateTime } from "luxon";

import { prisma } from "@/lib/prisma"; // ajuste se necessário
import { verifyJwt } from "@/lib/auth"; // ajuste se necessário
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoggedUser = {
  email: string;
  role?: string;
};

async function getLoggedUser(): Promise<LoggedUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? ""; // use o nome real do seu cookie

  if (!token) return { email: "", role: undefined };

  const payload: any = verifyJwt(token);
  return { email: payload?.email ?? "", role: payload?.role };
}

function toSaoPaulo(dt: Date) {
  // dt vem em JS Date (UTC se o ICS tem Z)
  const sp = DateTime.fromJSDate(dt, { zone: "utc" }).setZone("America/Sao_Paulo");
  return {
    date: sp.toISODate()!,       // YYYY-MM-DD
    time: sp.toFormat("HH:mm"),  // HH:mm
  };
}

function getExternalIdForEvent(item: any): { uid: string; externalId: string } {
  const uid = String(item?.uid ?? "").trim();
  // recurrenceid no node-ical pode ser Date ou string
  const rec =
    item?.recurrenceid instanceof Date
      ? item.recurrenceid.toISOString()
      : typeof item?.recurrenceid === "string"
        ? item.recurrenceid
        : null;

  const startIso =
    item?.start instanceof Date ? item.start.toISOString() : "";

  // Preferir RECURRENCE-ID quando existir, senão usar DTSTART.
  const instanceKey = (rec && rec.length > 0) ? rec : startIso;

  // Se por algum motivo não tiver instanceKey, cai pro UID puro (pode colidir em recorrência, mas é raro)
  const externalId = instanceKey ? `${uid}#${instanceKey}` : uid;

  return { uid, externalId };
}

function extractResponsible(item: any): { userName: string; userEmail: string; participantsEmails: string | null } {
  // 1) Tenta achar ATTENDEE INDIVIDUAL como responsável (primeiro attendee individual com CN)
  const attendeesRaw = item?.attendee;
  const attendeesArr = Array.isArray(attendeesRaw) ? attendeesRaw : (attendeesRaw ? [attendeesRaw] : []);

  const participants: string[] = [];

  let bestName: string | null = null;
  let bestEmail: string | null = null;

  for (const a of attendeesArr) {
    const params = a?.params ?? {};
    const cutype = String(params?.CUTYPE ?? "").toUpperCase();
    const cn = String(params?.CN ?? "").trim();

    // node-ical pode guardar valor em a.val ou o próprio "mailto:..."
    const val = String(a?.val ?? a ?? "").trim();
    const email = val.toLowerCase().startsWith("mailto:") ? val.slice(7) : val;
    const emailClean = email.includes("@") ? email : null;

    if (emailClean) participants.push(emailClean);

    // pega primeiro attendee INDIVIDUAL como responsável
    if (!bestEmail && cutype === "INDIVIDUAL" && (cn || emailClean)) {
      bestName = cn || null;
      bestEmail = emailClean;
    }
  }

  // 2) Fallback: nome no final do SUMMARY: "Titulo (Nome Sobrenome)"
  const summary = String(item?.summary ?? "").trim();
  if (!bestName && summary) {
    const m = summary.match(/\(([^)]+)\)\s*$/);
    if (m?.[1]) bestName = m[1].trim();
  }

  // 3) Fallback: tenta achar no DESCRIPTION (padrões comuns)
  const desc = String(item?.description ?? "").trim();
  if (!bestName && desc) {
    const m =
      desc.match(/Respons[aá]vel:\s*(.+)/i) ||
      desc.match(/Organizador:\s*(.+)/i) ||
      desc.match(/Criado por:\s*(.+)/i);

    if (m?.[1]) bestName = m[1].trim();
  }

  // 4) Último fallback: não usar organizer (porque geralmente é a própria agenda da sala)
  const userName = bestName || "Reservado";
  const userEmail = bestEmail || "unknown@import.local";

  // remove duplicados e o "unknown"
  const uniqueParticipants = Array.from(new Set(participants.filter((p) => p && p !== "unknown@import.local")));

  return {
    userName,
    userEmail,
    participantsEmails: uniqueParticipants.length ? uniqueParticipants.join(",") : null,
  };
}

export async function POST(req: Request) {
  try {
    const me = await getLoggedUser();
    if (!me?.email) return NextResponse.json({ ok: false, message: "Não autenticado" }, { status: 401 });
    if (me.role !== "admin") return NextResponse.json({ ok: false, message: "Sem permissão" }, { status: 403 });

    const form = await req.formData();
    const roomId = String(form.get("roomId") ?? "").trim();
    const file = form.get("file");
    const strategy = String(form.get("strategy") ?? "replace"); // replace | merge
    const batchSize = Number(form.get("batchSize") ?? 500);

    if (!roomId) return NextResponse.json({ ok: false, message: "roomId obrigatório" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "Arquivo .ics obrigatório" }, { status: 400 });

    const text = await file.text();
    const parsed = ical.sync.parseICS(text);

    const externalSource =
      /X-WR-CALNAME:(.+)\r?\n/i.exec(text)?.[1]?.trim() ?? null;

    // sala vem do lib/rooms.ts no front, então aqui guardamos somente o roomId e um nome genérico
    // Se você quiser o nome real, você pode enviar roomName no form também.
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

      // Se cruzar o dia, por simplicidade ignoramos. (Você pode evoluir depois para quebrar em 2 registros)
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

    // Dedup em memória por provider+externalId (garante zero P2002 dentro do mesmo arquivo)
    const deduped = Array.from(
      new Map(toInsert.map((x) => [`${x.provider}:${x.externalId}`, x])).values()
    );

    const duplicatesRemoved = toInsert.length - deduped.length;

    if (strategy === "replace") {
      // remove tudo importado via ICS desta sala e reimporta
      await prisma.booking.deleteMany({
        where: { provider: "ics", roomId },
      });
    }

    // Inserção em batches (evita 504)
    let inserted = 0;
    for (let i = 0; i < deduped.length; i += batchSize) {
      const batch = deduped.slice(i, i + batchSize);

      const result = await prisma.booking.createMany({
        data: batch,
        skipDuplicates: true, // protege contra duplicatas residuais
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