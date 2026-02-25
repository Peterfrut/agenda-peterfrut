export type Booking = {
  id: string;
  roomId: string;
  roomName: string;
  userName: string;
  userEmail: string;
  participantsEmails: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;

  // Integrações / importações
  provider?: "local" | "ics" | "google" | string;
  externalId?: string | null;
  externalSource?: string | null;
};
