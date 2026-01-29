"use client";

import { WORK_START_MIN, WORK_END_MIN } from "@/lib/rooms";
import type { Booking } from "@/lib/types/booking";
import { cn } from "@/lib/utils";

type Holiday = {
  id: string;
  name: string;
  date: string;
  roomId: string | null;
  source?: "national" | string;
};

function toMins(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

type Props = {
  days: { date: string; dayName: string; dayLabel: string }[];
  bookings: Booking[];
  holidays: Holiday[];
  selectedDateISO: string;                 
  onEventClick?: (b: Booking) => void;
  onEmptyClick?: (dateISO: string) => void; 
  onDaySelect?: (dateISO: string) => void;  
};

export function TimeGrid({
  days,
  bookings,
  holidays,
  selectedDateISO,
  onEventClick,
  onEmptyClick,
  onDaySelect,
}: Props) {
  const startMin = WORK_START_MIN;
  const endMin = WORK_END_MIN;
  const total = endMin - startMin;

  const pxPerMin = 1;
  const totalPx = Math.round(total * pxPerMin);

  const hourMarks: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m <= endMin; m += 60) hourMarks.push(m);

  const gridBg = `
    repeating-linear-gradient(
      to bottom,
      rgba(0,0,0,0) 0px,
      rgba(0,0,0,0) ${(30 * pxPerMin) - 1}px,
      rgba(0,0,0,0.06) ${(30 * pxPerMin) - 1}px,
      rgba(0,0,0,0.06) ${(30 * pxPerMin)}px
    ),
    repeating-linear-gradient(
      to bottom,
      rgba(0,0,0,0) 0px,
      rgba(0,0,0,0) ${(60 * pxPerMin) - 1}px,
      rgba(0,0,0,0.10) ${(60 * pxPerMin) - 1}px,
      rgba(0,0,0,0.10) ${(60 * pxPerMin)}px
    )
  `;

  const gridTemplateColumns = `80px repeat(${days.length}, minmax(220px, 1fr))`;

  return (
    <div className="w-full overflow-auto">
      {/* HEADER (sticky) */}
      <div
        className="grid sticky top-0 bg-background z-20 border-b border-border"
        style={{ gridTemplateColumns }}
      >
        <div className="p-2 text-xs text-muted-foreground flex items-center">
          GMT-03
        </div>

        {days.map((d) => {
          const selected = d.date === selectedDateISO;
          return (
            <button
              key={d.date}
              type="button"
              className={cn(
                "p-2 text-center border-l border-border transition",
                selected ? "bg-zinc-950 text-white" : "hover:bg-muted"
              )}
              onClick={() => onDaySelect?.(d.date)}
              title="Selecionar dia"
            >
              <div className={cn("text-xs font-semibold", selected ? "text-white/90" : "text-muted-foreground")}>
                {d.dayName}
              </div>
              <div className={cn("font-bold text-lg", selected ? "text-white" : "")}>
                {d.dayLabel}
              </div>
            </button>
          );
        })}
      </div>

      {/* ALL-DAY ROW (feriados) sticky abaixo do header */}
      <div
        className="grid sticky top-[56px] bg-background z-10 border-b border-border"
        style={{ gridTemplateColumns }}
      >
        <div className="p-2" />
        {days.map((d) => {
          const hs = holidays.filter((h) => h.date === d.date);
          return (
            <div key={d.date} className="p-2 min-h-[48px] border-l border-border">
              {hs.map((h) => (
                <div
                  key={h.id}
                  className="mb-1 rounded-md px-2 py-1 text-xs font-semibold bg-emerald-700/70 text-white"
                  title={h.name}
                >
                  {h.name} - {h.source === "national" ? "Feriado Nacional" : "Feriado"}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* BODY */}
      <div className="grid" style={{ gridTemplateColumns }}>
        {/* Coluna de horários */}
        <div className="relative border-r border-border bg-background">
          <div style={{ height: `${totalPx}px` }} className="relative">
            {hourMarks.map((m) => {
              const top = Math.round((m - startMin) * pxPerMin);
              return (
                <div
                  key={m}
                  className="absolute left-0 right-0 text-[11px] text-muted-foreground"
                  style={{ top: `${top}px` }}
                >
                  <div className="px-2 -translate-y-1/2">
                    {String(Math.floor(m / 60)).padStart(2, "0")}:00
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Colunas por dia */}
        {days.map((d) => {
          const dayBookings = bookings
            .filter((b) => b.date === d.date)
            .sort((a, b) => toMins(a.startTime) - toMins(b.startTime));

          return (
            <div key={d.date} className="relative border-r border-border">
              <div
                className="relative"
                style={{
                  height: `${totalPx}px`,
                  backgroundImage: gridBg,
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "repeat",
                }}
                // clique no grid vazio -> abrir form no dia da coluna
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-event]")) return;
                  onEmptyClick?.(d.date);
                }}
              >
                {dayBookings.map((b) => {
                  const topMin = clamp(toMins(b.startTime), startMin, endMin) - startMin;
                  const bottomMin = clamp(toMins(b.endTime), startMin, endMin) - startMin;

                  const top = Math.round(topMin * pxPerMin);
                  const height = Math.max(22, Math.round((bottomMin - topMin) * pxPerMin));

                  return (
                    <button
                      key={b.id}
                      data-event
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick?.(b);
                      }}
                      className={cn(
                        "absolute left-2 right-2 rounded-md px-2 py-1 text-left text-xs font-semibold",
                        "bg-emerald-700/60 hover:bg-emerald-700/80"
                      )}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="truncate">{b.title}</div>
                      <div className="text-[11px] opacity-90 truncate">
                        {b.startTime}–{b.endTime}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
