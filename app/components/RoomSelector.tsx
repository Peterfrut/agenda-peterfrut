"use client";

import { ROOMS } from "@/lib/rooms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

type Props = {
  value: string | undefined;
  onChange: (value: string) => void;
};

export function RoomSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Sala</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione uma sala" />
        </SelectTrigger>
        <SelectContent>
          {ROOMS.map((room) => (
            <SelectItem key={room.id} value={room.id}>
              {room.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
