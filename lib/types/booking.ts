export type Booking = {
  id: string;
  roomId: string;
  roomName: string;
  userName: string;
  userEmail: string;
  participantsEmails: string | null;
  title: string;        // <<< AQUI
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
};