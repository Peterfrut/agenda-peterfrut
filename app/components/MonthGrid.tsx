"use client";

import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Booking } from "@/lib/types/booking";
import { cn } from "@/lib/utils";
import { toISODateOnly } from "@/lib/time";

type Holiday = {
  id: string;
  name: string;
  date: string; 
  roomId: string | null;
  source?: "national" | string;
};

type Props = {
  baseDate: Date;
  bookings: Booking[];
  holidays: Holiday[];          
  selectedDate: Date;
  onDayClick: (date: Date) => void;
  onEmptyAreaClick: (date: Date) => void;
  onEventClick: (booking: Booking) => void;
  currentUserEmail?: string | null;
};

export function MonthGrid({
  baseDate,
  bookings,
  holidays,
  selectedDate,
  onDayClick,
  onEmptyAreaClick,
  onEventClick,
  currentUserEmail,
}: Props) {
  const startMonth = startOfMonth(baseDate);
  const endMonth = endOfMonth(baseDate);
  const startGrid = startOfWeek(startMonth, { weekStartsOn: 1 });

  const days: Date[] = [];
  let current = startGrid;
  while (current <= endMonth || days.length % 7 !== 0) {
    days.push(current);
    current = addDays(current, 1);
  }

  return (
    <div className="w-full">
      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 text-xs mb-2">
        {["Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb.", "Dom."].map((d) => (
          <div
            key={d}
            className="text-[14px] font-semibold text-center text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 text-xs m-0 p-0">
        {days.map((day) => {
          const dayStr = toISODateOnly(day);

          const dayBookings = bookings.filter((b) => b.date === dayStr);

          // Feriados do dia (pode ter mais de um)
          const dayHolidays = holidays.filter((h) => h.date === dayStr);

          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          const otherMonth = !isSameMonth(day, baseDate);

          // Monta lista final de “itens do dia”
          // Feriados primeiro, depois reservas.
          const items = [
            ...dayHolidays.map((h) => ({
              kind: "holiday" as const,
              id: `holiday-${h.id}`,
              label: `${h.name} - ${h.source === "national" ? "Feriado Nacional" : "Feriado"}`,
            })),
            ...dayBookings.map((b) => ({
              kind: "booking" as const,
              id: b.id,
              booking: b,
              label:
                currentUserEmail &&
                b.userEmail?.toLowerCase() === currentUserEmail.toLowerCase() &&
                b.title
                  ? `${b.startTime}-${b.endTime} · ${b.title}`
                  : `${b.startTime}-${b.endTime} · ${b.userName}`,
            })),
          ];

          return (
            <div
              key={dayStr}
              className="flex flex-col border"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-event]")) return;
                onEmptyAreaClick(day);
              }}
            >
              {/* número do dia */}
              <div
                className="flex justify-center items-center py-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onDayClick(day);
                }}
              >
                <span
                  className={cn(
                    "flex items-center justify-center text-xs font-semibold w-7 h-7 rounded-full cursor-pointer hover:bg-muted",
                    isToday && "bg-primary text-secondary",
                    otherMonth && "bg-muted/40 text-muted-foreground",
                    isSelected && !isToday && "border border-zinc-900"
                  )}
                >
                  {format(day, "d", { locale: ptBR })}
                </span>
              </div>

              {/* eventos do dia */}
              <button
                type="button"
                className={cn(
                  "flex flex-col px-1 min-h-[116px] text-left transition focus:outline-none focus:ring-2 focus:ring-ring",
                  otherMonth && "bg-muted"
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-event]")) return;
                  onEmptyAreaClick(day);
                }}
              >
                <div>
                  {items.slice(0, 4).map((it) => {
                    if (it.kind === "holiday") {
                      return (
                        <div
                          key={it.id}
                          data-event
                          className={cn(
                            "flex items-center justify-center gap-1 p-1 rounded-full text-[12px] font-semibold",
                            "bg-emerald-700/70 text-white"
                          )}
                          title={it.label}
                          onClick={(e) => e.stopPropagation()} // feriado não abre detalhes
                        >
                          <div className="w-[9px] h-2 rounded-full bg-emerald-200" />
                          <div className="truncate w-full">{it.label}</div>
                        </div>
                      );
                    }

                    // booking normal
                    return (
                      <div
                        key={it.id}
                        data-event
                        className="flex justify-center items-center gap-1 p-1 rounded-full text-[12px] font-semibold hover:bg-muted cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(it.booking);
                        }}
                      >
                        <div className="w-[9px] h-2 rounded-full bg-emerald-600" />
                        <div className="truncate w-full">{it.label}</div>
                      </div>
                    );
                  })}

                  {items.length > 4 && (
                    <div className="text-[10px] font-semibold text-muted-foreground">
                      +{items.length - 4} itens.
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}