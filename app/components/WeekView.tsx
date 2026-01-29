"use client";

import type { Booking } from "@/lib/types/booking";

import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/app/components/ui/card";
import { toISODateOnly } from "@/lib/time";

type Props = {
  date: Date;
  bookings: Booking[];
};

export function WeekView({ date, bookings }: Props) {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // segunda
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <Card className="mt-6 p-4">
      <h2 className="font-semibold mb-3">
        Semana de {format(start, "dd/MM/yyyy")} a{" "}
        {format(addDays(start, 6), "dd/MM/yyyy")}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 text-xs">
        {days.map((d) => {
          const dayStr = toISODateOnly(d);
          const dayBookings = bookings.filter((b) => b.date === dayStr);

          return (
            <div key={dayStr} className="border rounded p-2 min-h-[80px]">
              <p className="font-semibold mb-1">
                {format(d, "EEE dd", { locale: ptBR })}
              </p>
              {dayBookings.length === 0 && (
                <p className="text-muted-foreground">—</p>
              )}
              {dayBookings.map((b) => (
                <p key={b.id}>
                  {b.startTime}-{b.endTime} · {b.userName}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}