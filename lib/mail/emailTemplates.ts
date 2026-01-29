export function buildBookingHtml({
  roomName,
  userName,
  dateFormatted,
  startTime,
  endTime,
  participants,
}: {
  roomName: string;
  userName: string;
  dateFormatted: string;
  startTime: string;
  endTime: string;
  participants: string[];
}) {
  const participantsList =
    participants.length > 0
      ? participants.join(", ")
      : "Nenhum participante informado";

  return `
  <div style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px;">
    <div style="
      max-width: 600px; 
      margin: auto; 
      background: white; 
      border-radius: 8px; 
      padding: 20px; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    ">
      
      <!-- LOGO -->
      <div style="text-align: center; margin-bottom: 20px;">
        <img src=""
          alt="Peterfrut Logo" 
          style="width: 180px; height: auto;" />
      </div>

      <!-- TÍTULO -->
      <h2 style="text-align: center; color: #333; margin-top: 0;">
        Confirmação de Agendamento
      </h2>

      <p style="font-size: 15px; color: #333;">
        Olá <strong>${userName}</strong>, seu agendamento foi registrado com sucesso.
      </p>

      <!-- CARD DE INFORMAÇÕES -->
      <div style="
        background: #f0f5ff; 
        border-left: 4px solid #3b82f6;
        padding: 12px 16px;
        border-radius: 4px;
        margin: 20px 0;
      ">
        <p style="margin: 4px 0;"><strong>Sala:</strong> ${roomName}</p>
        <p style="margin: 4px 0;"><strong>Data:</strong> ${dateFormatted}</p>
        <p style="margin: 4px 0;"><strong>Horário:</strong> ${startTime} às ${endTime}</p>
        <p style="margin: 4px 0;"><strong>Participantes:</strong> ${participantsList}</p>
      </div>

      <p style="font-size: 14px; color: #555;">
        Caso precise cancelar ou remarcar, acesse o sistema:
      </p>

      <div style="text-align:center; margin: 20px 0;">
        <a 
          href="${process.env.NEXT_PUBLIC_APP_URL}/bookings" 
          style="
            background: #3b82f6; 
            color: white; 
            padding: 10px 18px; 
            border-radius: 6px; 
            text-decoration: none; 
            font-size: 14px;
          "
        >
          Abrir Agenda de Salas
        </a>
      </div>

      <p style="font-size: 13px; color: #888; text-align:center; margin-top: 30px;">
        © ${new Date().getFullYear()} Peterfrut – Sistema de Agendamentos
      </p>

    </div>
  </div>
  `;
}
