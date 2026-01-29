import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import prisma from "@/lib/prisma";
import { resend, getFromEmail } from "@/lib/mailer";
import fs from "fs";
import path from "path";

export type BookingLike = {
  id: string;
  roomId: string;
  roomName: string;
  userName: string;
  userEmail: string;
  participantsEmails: string | null;
  date: string;
  startTime: string; 
  endTime: string; 
  title?: string | null;
};

export type MailKind = "created" | "updated" | "canceled" | "reminder";
type RecipientRole = "owner" | "participant";

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function isInternalPeterfrutEmail(email: string) {
  const e = normalizeEmail(email);
  return e.endsWith("@peterfrut.com.br");
}

async function hasUserAccount(email: string): Promise<boolean> {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) return false;

  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { id: true },
  });

  return !!user?.id;
}

/**
 - Em produção, use HTTPS (muitos clientes bloqueiam imagens http).
 - Em dev, pode ser localhost.
 */
function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function resolveDisplayName(email: string): Promise<string> {
  const emailNorm = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { name: true },
  });

  if (user?.name?.trim()) return user.name.trim();
  return emailNorm.split("@")[0];
}

/**
 * Teams link por sala
 * IDs precisam bater com rooms.ts
 */
const TEAMS_BY_ROOM_ID: Record<string, string> = {
  sala_reuniao_sup: process.env.TEAMS_LINK_SALA_REUNIAO || "",
  auditorio_sup: process.env.TEAMS_LINK_AUDITORIO || "",
};

/**
 * QR por sala (arquivos em /public/qr/)
 * Ex.: public/qr/sala_reuniao_sup.png
 */
const QR_PNG_BY_ROOM_ID: Record<string, string> = {
  sala_reuniao_sup: "/qr/sala_reuniao_sup.png",
  auditorio_sup: "/qr/auditorio_sup.png",
};

function buildAgendaLink(booking: BookingLike) {
  const base = getBaseUrl();
  const url = new URL(base);
  url.searchParams.set("roomId", booking.roomId);
  url.searchParams.set("date", booking.date);
  return url.toString();
}

function buildSubject(kind: MailKind, booking: BookingLike, role: RecipientRole) {
  const d = new Date(`${booking.date}T00:00:00`);
  const dateLabel = format(d, "dd/MM/yyyy", { locale: ptBR });
  const timeLabel = `${booking.startTime} - ${booking.endTime}`;

  if (role === "participant") {
    switch (kind) {
      case "created":
        return `Convite para reunião · ${booking.roomName} · ${dateLabel} ${timeLabel}`;
      case "updated":
        return `Reunião remarcada · ${booking.roomName} · ${dateLabel} ${timeLabel}`;
      case "canceled":
        return `Reunião cancelada · ${booking.roomName} · ${dateLabel} ${timeLabel}`;
      case "reminder":
        return `Lembrete de reunião · ${booking.roomName} · ${dateLabel} ${timeLabel}`;
    }
  }

  switch (kind) {
    case "created":
      return `Confirmação de reserva · ${booking.roomName} · ${dateLabel} ${timeLabel}`;
    case "updated":
      return `Reserva remarcada · ${booking.roomName} · ${dateLabel} ${timeLabel}`;
    case "canceled":
      return `Reserva cancelada · ${booking.roomName} · ${dateLabel} ${timeLabel}`;
    case "reminder":
      return `Lembrete de reserva · ${booking.roomName} · ${dateLabel} ${timeLabel}`;
  }
}

/**
 * Retorna null se não existir.
 */
function readPublicFileAsBase64(publicPath: string): string | null {
  try {
    const abs = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs).toString("base64");
  } catch {
    return null;
  }
}

type HtmlOptions = {
  // Fallbacks remotos (se quiser manter)
  logoUrl?: string; // URL ABSOLUTA (https://.../logo.png)
  qrUrl?: string; // URL ABSOLUTA (https://.../qr/xxx.png)
  teamsUrl?: string;

  logoCid?: string; // ex: "logo-image"
  qrCid?: string; // ex: "qr-image"
};

async function buildHtml(
  kind: MailKind,
  booking: BookingLike,
  role: RecipientRole,
  recipientEmail: string,
  opts: HtmlOptions
) {
  const d = new Date(`${booking.date}T00:00:00`);
  const dateLong = format(d, "dd 'de' MMMM 'de' yyyy (EEEE)", { locale: ptBR });
  const timeLabel = `${booking.startTime} às ${booking.endTime}`;
  const agendaLink = buildAgendaLink(booking);

  const participantsList = booking.participantsEmails
    ? booking.participantsEmails
        .split(",")
        .map((e) => normalizeEmail(e))
        .filter(Boolean)
        .join(", ")
    : "Nenhum participante informado";

  const recipientName =
    role === "owner"
      ? await resolveDisplayName(booking.userEmail)
      : await resolveDisplayName(recipientEmail);

  let title = "";
  let intro = "";
  let highlightColor = "#3b82f6";
  let highlightLabel = "";

  if (role === "participant") {
    switch (kind) {
      case "created":
        title = "Convite de Reunião";
        intro = `Olá <strong>${recipientName}</strong>, você foi convidado para uma reunião feita por <strong>${booking.userName}</strong>.`;
        highlightLabel = "Detalhes da reunião";
        highlightColor = "#16a34a";
        break;
      case "updated":
        title = "Reunião Remarcada";
        intro = `Olá <strong>${recipientName}</strong>, a reunião organizada por <strong>${booking.userName}</strong> foi <strong>remarcada</strong>. Confira os novos detalhes abaixo.`;
        highlightLabel = "Novos detalhes da reunião";
        highlightColor = "#f97316";
        break;
      case "canceled":
        title = "Reunião Cancelada";
        intro = `Olá <strong>${recipientName}</strong>, a reunião organizada por <strong>${booking.userName}</strong> foi <strong>cancelada</strong>.`;
        highlightLabel = "Reunião cancelada";
        highlightColor = "#dc2626";
        break;
      case "reminder":
        title = "Lembrete de Reunião";
        intro = `Olá <strong>${recipientName}</strong>, este é um lembrete da reunião organizada por <strong>${booking.userName}</strong>.`;
        highlightLabel = "Lembrete de reunião";
        highlightColor = "#3b82f6";
        break;
    }
  } else {
    switch (kind) {
      case "created":
        title = "Confirmação de Agendamento";
        intro = `Olá <strong>${recipientName}</strong>, sua reserva foi registrada com sucesso.`;
        highlightLabel = "Detalhes da reserva";
        highlightColor = "#16a34a";
        break;
      case "updated":
        title = "Reserva Remarcada";
        intro = `Olá <strong>${recipientName}</strong>, sua reserva foi <strong>remarcada</strong>. Confira os novos detalhes abaixo.`;
        highlightLabel = "Novos detalhes da reserva";
        highlightColor = "#f97316";
        break;
      case "canceled":
        title = "Reserva Cancelada";
        intro = `Olá <strong>${recipientName}</strong>, sua reserva foi <strong>cancelada</strong>.`;
        highlightLabel = "Reserva cancelada";
        highlightColor = "#dc2626";
        break;
      case "reminder":
        title = "Lembrete de Reserva";
        intro = `Olá <strong>${recipientName}</strong>, este é um lembrete da sua reserva que ocorrerá em breve.`;
        highlightLabel = "Lembrete de reserva";
        highlightColor = "#3b82f6";
        break;
    }
  }

  const teamsUrl = (opts.teamsUrl || "").trim();

  // Se tiver CID, usa cid:...; senão usa URL remota
  const logoSrc = opts.logoCid ? `cid:${opts.logoCid}` : opts.logoUrl || "";
  const qrSrc = opts.qrCid ? `cid:${opts.qrCid}` : opts.qrUrl || "";

  const hasTeams = teamsUrl.length > 0;
  const hasQr = qrSrc.trim().length > 0;

  // Regras de CTA (Abrir Agenda / Criar cadastro / nada)
  const recipientIsInternal = isInternalPeterfrutEmail(recipientEmail);

  let recipientHasAccount = false;
  if (role === "participant" && recipientIsInternal) {
    recipientHasAccount = await hasUserAccount(recipientEmail);
  }

  const canShowAgendaActions =
    role === "owner" || (role === "participant" && recipientIsInternal && recipientHasAccount);

  const mustShowRegisterCta = role === "participant" && recipientIsInternal && !recipientHasAccount;

  const base = getBaseUrl();
  const registerLink = new URL("/register", base);
  registerLink.searchParams.set("email", normalizeEmail(recipientEmail));
  registerLink.searchParams.set("next", agendaLink);

  const meetingBlock =
    kind === "canceled" || (!hasTeams && !hasQr)
      ? ""
      : `
      <div style="padding:16px 0 0 0;border-radius:8px;margin: 16px 0;">
        <p style="margin:0 0 8px 0; font-weight:600; color:#111827;">
          ${hasQr ? "Compartilhe o QR Code abaixo com os participantes" : "Acesse pelo link abaixo"}
        </p>

        ${
          hasQr
            ? `
          <div style="text-align:center; margin: 10px 0;">
            <img src="${qrSrc}" alt="QR Code" style="width:160px;height:160px;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
            <p style="margin:8px 0 0 0; font-size:12px; color:#6b7280;">
              Aponte a câmera para entrar
            </p>
          </div>
        `
            : ""
        }

        ${
          hasTeams
            ? `
          <p style="margin:0; font-size:13px; color:#374151;">
            Link direto:
          </p>
          <p style="margin:6px 0 0 0; font-size:13px;">
            <a href="${teamsUrl}" style="color:#2563eb; word-break:break-all;">${teamsUrl}</a>
          </p>
        `
            : ""
        }
      </div>
    `;

  let buttonLabel = "Abrir Agenda de Salas";
  if (kind === "reminder") buttonLabel = "Confirmar / Ver reserva";
  else if (kind === "canceled") buttonLabel = "Abrir Agenda";

  const agendaBlockHtml = canShowAgendaActions
    ? `
      <p style="font-size:14px;color:#6b7280;">
        Você pode visualizar, remarcar ou cancelar esta reserva diretamente no sistema:
      </p>

      <div style="text-align:center;margin:20px 0;">
        <a href="${agendaLink}" style="background:${highlightColor};color:white;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block;">
          ${buttonLabel}
        </a>
      </div>
    `
    : mustShowRegisterCta
      ? `
      <div style="background:#fff7ed;border-left:4px solid #f97316;padding:14px 16px;border-radius:8px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#111827;">
          Você não possui cadastro para acessar a Agenda de Salas.
        </p>
        <p style="margin:8px 0 0 0;font-size:13px;color:#6b7280;">
          Crie seu cadastro com seu e-mail corporativo para visualizar detalhes e gerenciar suas reservas.
        </p>
      </div>

      <div style="text-align:center;margin:18px 0;">
        <a href="${registerLink.toString()}" style="background:#f97316;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block;">
          Criar cadastro
        </a>
      </div>
    `
      : "";

  return `
  <div style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:8px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
      
      <div style="text-align:center;margin-bottom:20px;">
        ${
          logoSrc
            ? `<img src="${logoSrc}" alt="Peterfrut Logo" style="width:180px;height:auto;border:0;outline:none;text-decoration:none;" />`
            : `<div style="font-weight:700;font-size:18px;color:#111827;">Peterfrut</div>`
        }
      </div>

      <h2 style="text-align:center;color:#111827;margin-top:0;margin-bottom:8px;">
        ${title}
      </h2>

      <p style="font-size:15px;color:#374151;margin-top:0;">
        ${intro}
      </p>

      <div style="background:#f9fafb;border-left:4px solid ${highlightColor};padding:16px 16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 8px 0;font-weight:600;color:#111827;">
          ${highlightLabel}
        </p>

        ${booking.title ? `<p style="margin:4px 0;"><strong>Título:</strong> ${booking.title}</p>` : ""}
        <p style="margin:4px 0;"><strong>Sala:</strong> ${booking.roomName}</p>
        <p style="margin:4px 0;"><strong>Data:</strong> ${dateLong}</p>
        <p style="margin:4px 0;"><strong>Horário:</strong> ${timeLabel}</p>
        <p style="margin:4px 0;"><strong>Responsável:</strong> ${booking.userName} &lt;${booking.userEmail}&gt;</p>
        <p style="margin:4px 0;"><strong>Participantes:</strong> ${participantsList}</p>
      </div>

      ${meetingBlock}

      ${agendaBlockHtml}

      <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:24px;">
        Este e-mail foi gerado automaticamente pela Agenda de Salas Peterfrut.
      </p>
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:4px;">
        © ${new Date().getFullYear()} Peterfrut – Todos os direitos reservados.
      </p>
    </div>
  </div>
  `;
}

export async function sendBookingEmail(kind: MailKind, booking: BookingLike) {
  const from = getFromEmail();
  const base = getBaseUrl();

  // Remotos (fallback)
  const logoUrl = new URL("/logo_peterfrut.png", base).toString();

  const teamsUrl = (TEAMS_BY_ROOM_ID[booking.roomId] || "").trim();
  const qrPath = QR_PNG_BY_ROOM_ID[booking.roomId]; // "/qr/....png"
  const qrUrl = qrPath ? new URL(qrPath, base).toString() : undefined;
  const logoCid = "logo-image";
  const qrCid = "qr-image";

  const logoBase64 = readPublicFileAsBase64("/logo_peterfrut.png");
  const qrBase64 = qrPath ? readPublicFileAsBase64(qrPath) : null;

  const attachments: Array<{
    content?: string;
    filename: string;
    contentId?: string;
    contentType?: string;
    path?: string;
  }> = [];

  // Logo inline (se arquivo existir)
  if (logoBase64) {
    attachments.push({
      content: logoBase64,
      filename: "logo_peterfrut.png",
      contentId: logoCid,
      contentType: "image/png",
    });
  }

  // QR inline (se arquivo existir)
  if (qrBase64 && qrPath) {
    const filename = path.basename(qrPath);
    attachments.push({
      content: qrBase64,
      filename,
      contentId: qrCid,
      contentType: "image/png",
    });
  }

  // Helper Resend
  async function send(to: string, subject: string, html: string) {
    const result = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
      attachments: attachments.length ? attachments : undefined,
    });

    if (result.error) {
      console.error("[RESEND] send error:", result.error);
      throw new Error("Falha ao enviar e-mail.");
    }
  }

  async function sendToRecipient(role: RecipientRole, toEmail: string) {
    const subject = buildSubject(kind, booking, role);

    const html = await buildHtml(kind, booking, role, toEmail, {
      // se tiver inline, usa CID; senão cai no URL remoto
      logoCid: logoBase64 ? logoCid : undefined,
      qrCid: qrBase64 ? qrCid : undefined,
      logoUrl: logoBase64 ? undefined : logoUrl,
      qrUrl: qrBase64 ? undefined : qrUrl,
      teamsUrl,
    });

    console.log(`[MAIL] RESEND (${kind}, ${role}) → ${toEmail} · ${subject}`);
    await send(toEmail, subject, html);
  }

  // 1) Organizador
  const ownerEmail = normalizeEmail(booking.userEmail);
  try {
    await sendToRecipient("owner", ownerEmail);
  } catch (err) {
    console.error("[MAIL] ERRO ao enviar e-mail para organizador:", err);
  }

  // 2) Participantes
  if (booking.participantsEmails) {
    const extra = booking.participantsEmails
      .split(",")
      .map((e) => normalizeEmail(e))
      .filter(Boolean);

    for (const email of extra) {
      try {
        await sendToRecipient("participant", email);
      } catch (err) {
        console.error(`[MAIL] ERRO ao enviar e-mail para participante ${email}:`, err);
      }
    }
  }
}
