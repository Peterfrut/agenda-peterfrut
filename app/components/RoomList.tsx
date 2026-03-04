import { ROOMS, PERSONAL_ROOM_ID } from "@/lib/rooms";
const MY_AGENDA_ID = "__my__";

type Props = {
  value?: string;
  onChange: (id: string | undefined) => void;
};

export function RoomList({ value, onChange }: Props) {
  return (
    <div className="">
      {/* Minha agenda (virtual) */}
      <button
        type="button"
        onClick={() => onChange(MY_AGENDA_ID)}
        className={`w-full text-left px-3 py-3 text-sm border-b ${
          value === MY_AGENDA_ID
            ? "bg-primary/90 text-primary-foreground"
            : "bg-background hover:bg-muted"
        }`}
      >
        Minha Agenda Pessoal
      </button>

      {/* Salas reais */}
      {ROOMS.filter((room) => room.id !== PERSONAL_ROOM_ID).map((room) => (
        <button
          key={room.id}
          type="button"
          onClick={() => onChange(room.id)}
          className={`w-full text-left px-3 py-3 text-sm border-b cursor-pointer ${
            value === room.id
              ? "bg-primary/90 text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
        >
          {room.name}
        </button>
      ))}
    </div>
  );
}

// exporte o ID especial para usar na SchedulePage
export { MY_AGENDA_ID };
