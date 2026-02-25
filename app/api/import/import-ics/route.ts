// app/api/import/import-ics/route.ts
import { NextResponse, NextRequest } from "next/server";
import * as ical from "node-ical";
import { DateTime } from "luxon";
import { cookies } from "next/headers";

import prisma from "@/lib/prisma";
import { verifyJwt } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoggedUser = { email: string; role?: string };

async function readToken(req: NextRequest) {
  // cookies() na sua versão retorna Promise
  const cookieStore = await cookies();

  const tokenFromCookiesFn = cookieStore.get("token")?.value ?? "";
  const tokenFromReq = req.cookies.get("token")?.value ?? "";

  const token = tokenFromCookiesFn || tokenFromReq;

  return {
    token,
    tokenFromCookiesFnLen: tokenFromCookiesFn.length,
    tokenFromReqLen: tokenFromReq.length,
  };
}

async function getLoggedUser(req: NextRequest): Promise<{ me: LoggedUser; diag: any }> {
  const { token, tokenFromCookiesFnLen, tokenFromReqLen } = await readToken(req);

  if (!token) {
    return {
      me: { email: "", role: undefined },
      diag: {
        reason: "no-token-cookie",
        tokenFromCookiesFnLen,
        tokenFromReqLen,
        hasCookieHeader: Boolean(req.headers.get("cookie")),
      },
    };
  }

  try {
    const payload: any = await verifyJwt(token);

    // pega sub (id) e email (se existir)
    const sub = String(payload?.sub ?? "").trim();
    const emailFromToken = String(payload?.email ?? "").trim();
    const roleFromToken = String(payload?.role ?? "").trim();

    // Se tiver email direto, ok
    if (emailFromToken) {
      return {
        me: { email: emailFromToken, role: roleFromToken || undefined },
        diag: { reason: "ok-email", tokenFromCookiesFnLen, tokenFromReqLen },
      };
    }

    // Se não tiver email, mas tiver sub, busca no banco
    if (sub) {
      const user = await prisma.user.findUnique({
        where: { id: sub },
        select: { email: true, role: true },
      });

      if (user?.email) {
        return {
          me: { email: user.email, role: user.role ?? undefined },
          diag: { reason: "ok-sub-db", tokenFromCookiesFnLen, tokenFromReqLen },
        };
      }

      return {
        me: { email: "", role: undefined },
        diag: { reason: "sub-not-found", sub, tokenFromCookiesFnLen, tokenFromReqLen },
      };
    }

    // Nem email nem sub
    return {
      me: { email: "", role: undefined },
      diag: {
        reason: "payload-missing-email-and-sub",
        payloadKeys: payload ? Object.keys(payload) : null,
        tokenFromCookiesFnLen,
        tokenFromReqLen,
      },
    };
  } catch (e: any) {
    return {
      me: { email: "", role: undefined },
      diag: {
        reason: "verifyJwt-failed",
        error: e?.message ?? String(e),
        tokenFromCookiesFnLen,
        tokenFromReqLen,
      },
    };
  }
}

function toSaoPaulo(dt: Date) {
  const sp = DateTime.fromJSDate(dt, { zone: "utc" }).setZone("America/Sao_Paulo");
  return { date: sp.toISODate()!, time: sp.toFormat("HH:mm") };
}

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

function extractResponsible(item: any): {
  userName: string;
  userEmail: string;
  participantsEmails: string | null;
} {
  const attendeesRaw = item?.attendee;
  const attendeesArr = Array.isArray(attendeesRaw) ? attendeesRaw : attendeesRaw ? [attendeesRaw] : [];

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

  const uniqueParticipants = Array.from(new Set(participants.filter((p) => p && p !== "unknown@import.local")));

  return {
    userName,
    userEmail,
    participantsEmails: uniqueParticipants.length ? uniqueParticipants.join(",") : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { me, diag } = await getLoggedUser(req);

    if (!me.email) {
      // <<< diagnóstico controlado pra você ver exatamente o motivo >>>
      return NextResponse.json({ ok: false, message: "Não autenticado", diag }, { status: 401 });
    }
    if (me.role !== "admin") {
      return NextResponse.json({ ok: false, message: "Sem permissão", role: me.role ?? null }, { status: 403 });
    }

    const form = await req.formData();
    const roomId = String(form.get("roomId") ?? "").trim();
    const file = form.get("file");
    const strategy = String(form.get("strategy") ?? "replace");
    const batchSize = Number(form.get("batchSize") ?? 500);

    if (!roomId) return NextResponse.json({ ok: false, message: "roomId obrigatório" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "Arquivo .ics obrigatório" }, { status: 400 });

    const text = await file.text();
    const parsed = ical.sync.parseICS(text);

    const externalSource = /X-WR-CALNAME:(.+)\r?\n/i.exec(text)?.[1]?.trim() ?? null;
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

    const deduped = Array.from(new Map(toInsert.map((x) => [`${x.provider}:${x.externalId}`, x])).values());
    const duplicatesRemoved = toInsert.length - deduped.length;

    if (strategy === "replace") {
      await prisma.booking.deleteMany({ where: { provider: "ics", roomId } });
    }

    let inserted = 0;
    const size = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 500;

    for (let i = 0; i < deduped.length; i += size) {
      const batch = deduped.slice(i, i + size);
      const result = await prisma.booking.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
    }

    return NextResponse.json({
      ok: true,
      message: "Importação concluída",
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
    return NextResponse.json({ ok: false, message: e?.message ?? "Erro ao importar ICS" }, { status: 500 });
  }
}