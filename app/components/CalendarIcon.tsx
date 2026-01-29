export function CalendarDayIcon({ day }: { day: number }) {
  return (
    <div className="flex h-10 w-10 flex-col overflow-hidden rounded-[5px] border bg-card shadow-sm">
      {/* faixa vermelha superior */}
      <div className="flex h-3 items-center justify-center bg-red-500">
        {/* “pinos” superiores */}
        <div className="flex gap-3">
          <span className="h-2 w-0.5 rounded-full bg-white/80" />
          <span className="h-2 w-0.5 rounded-full bg-white/80" />
        </div>
      </div>
      {/* número do dia */}
      <div className="flex flex-1 items-center justify-center bg-background">
        <span className="text-[20px] font-semibold leading-none">
          {day.toString().padStart(1, "0")}
        </span>
      </div>
    </div>
  );
}