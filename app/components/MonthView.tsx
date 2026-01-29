"use client";

import type { Booking } from "@/lib/types/booking";


import {
  addDays,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/app/components/ui/card";
import { toISODateOnly } from "@/lib/time";

type Props = {
  date: Date;
  bookings: Booking[];
};

export function MonthView({ date, bookings }: Props) {
  const startMonth = startOfMonth(date);
  const endMonth = endOfMonth(date);
  const startGrid = startOfWeek(startMonth, { weekStartsOn: 1 });

  const days: Date[] = [];
  let current = startGrid;
  while (current <= endMonth || days.length % 7 !== 0) {
    days.push(current);
    current = addDays(current, 1);
  }

  return (
    <Card className="mt-6 p-4">
      <h2 className="font-semibold mb-3">
        Mês de {format(date, "MMMM yyyy", { locale: ptBR })}
      </h2>
      <div className="grid grid-cols-7 gap-1 text-[11px]">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="font-semibold text-center">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const dayStr = toISODateOnly(d);
          const dayBookings = bookings.filter((b) => b.date === dayStr);
          const isOtherMonth = d.getMonth() !== date.getMonth();

          return (
            <div
              key={dayStr}
              className={`border rounded p-1 min-h-[70px] ${
                isOtherMonth ? "bg-muted/40" : ""
              }`}
            >
              <p className="font-semibold text-right mb-1 text-xs">
                {format(d, "d")}
              </p>
              {dayBookings.slice(0, 3).map((b) => (
                <p key={b.id} className="truncate">
                  {b.startTime}-{b.endTime} · {b.userName}
                </p>
              ))}
              {dayBookings.length > 3 && (
                <p className="text-[10px] text-muted-foreground">
                  +{dayBookings.length - 3} reservas
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}