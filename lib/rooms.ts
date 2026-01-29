export const PERSONAL_ROOM_ID = "room_pessoal";

export type Room = {
  id: string;
  name: string;
};

export const ROOMS: Room[] = [
  { id: "auditorio_sup", name: "Auditório - Andar Superior" },
  { id: "sala_reuniao_inf", name: "Sala de Reunião - Andar Inferior" },
  { id: "sala_reuniao_sup", name: "Sala de Reunião - Andar Superior" },
  { id: "sala_atendimento_1", name: "Sala de Atendimento I - Andar Inferior" },
  { id: "sala_atendimento_2", name: "Sala de Atendimento II - Andar Inferior" },
  { id: "sala_atendimento_3", name: "Sala de Atendimento III - Andar Inferior" },
  { id: PERSONAL_ROOM_ID, name: "Agenda Pessoal" },
];

// expediente: 06:00 até 17:30 (slots de 30 min)
export const WORK_START_MIN = 6 * 60;       // 360
export const WORK_END_MIN   = 17 * 60 + 30; // 1050
