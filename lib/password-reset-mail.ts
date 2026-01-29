import { resend, getFromEmail } from "./mailer";
import fs from "fs";
import path from "path";


export async function sendPasswordResetEmail(opts: {
  to: string;
  name?: string | null;
  resetUrl: string;
}) {
  const displayName = opts.name?.trim() ? opts.name : opts.to.split("@")[0];
  const logoPath = path.join(process.cwd(), "public", "logo_peterfrut.png");
  const logoBuffer = fs.readFileSync(logoPath);

  const html = `
  <div style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px;">
    <div style="
      max-width: 600px;
      margin: auto;
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    ">
      <div style="text-align:center;margin-bottom:20px;">
        <!-- LOGO via CID -->
        <img src="cid:peterfrut-logo" alt="Peterfrut Logo" style="width:180px;height:auto;" />
      </div>

      <h2 style="margin: 0 0 12px 0; color:#111827; text-align:center;">Redefinição de Senha</h2>

      <p style="font-size: 14px; color: #374151;">
        Olá <strong>${displayName}</strong>, recebemos uma solicitação para redefinir sua senha, este link é <strong>válido por 15 minutos</strong>.
      </p>

      <p style="font-size: 14px; color: #374151;">
        <strong>Clique no botão abaixo</strong> para criar uma nova senha. <strong>Se você não solicitou isso, ignore este e-mail</strong>.
      </p>

      <div style="text-align:center; margin: 18px 0;">
        <a href="${opts.resetUrl}"
          style="
            background: #16a34a;
            color: white;
            padding: 10px 18px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 14px;
            display: inline-block;
          ">
          Redefinir senha
        </a>
      </div>

      <p style="font-size: 12px; color: #6b7280;">
        Se o botão não funcionar, copie e cole este link no navegador:
      </p>
      <p style="font-size: 12px; color: #111827; word-break: break-all;">
        ${opts.resetUrl}
      </p>

      <p style="font-size: 11px; color: #9ca3af; text-align:center; margin-top: 24px;">
        Este e-mail foi gerado automaticamente Agenda Peterfrut.
      </p>
    </div>
  </div>
  `;

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to: [opts.to],
    subject: "Redefinição de senha",
    html,
    attachments: [
      {
        filename: "logo.png",
        content: logoBuffer,
        contentId: "peterfrut-logo",
      }
    ]
  });

  if (error) {
    console.error("[PASSWORD RESET EMAIL] error:", error);
    throw new Error("Erro ao enviar e-mail de redefinição de senha");
  }
}
