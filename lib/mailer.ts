import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  // Não dê throw se buildar local sem env.
  console.warn("[MAILER] RESEND_API_KEY não configurada.");
}

export const resend = new Resend(apiKey);

export function getFromEmail() {
  return process.env.EMAIL_FROM || "Agenda Peterfrut <no-reply@peterfrut.com.br>";
}
