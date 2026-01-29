import { addDays, addMonths, addWeeks, format, getDay, parseISO } from "date-fns";

export type RecurrenceMode = "none" | "daily" | "weekly" | "monthly" | "weeklyByDay";

export type RecurrenceInput = {
  mode: RecurrenceMode;
  until?: string;        
  weekDays?: number[];    
};

const MAX_OCCURRENCES = 180;

export function expandRecurrenceDates(startDateISO: string, r?: RecurrenceInput): string[] {
  if (!r || r.mode === "none") return [startDateISO];

  const start = parseISO(startDateISO);
  const until = r.until ? parseISO(r.until) : addMonths(start, 3); // default: 3 meses

  const out: string[] = [];
  const push = (d: Date) => out.push(format(d, "yyyy-MM-dd"));

  if (r.mode === "daily") {
    let cur = start;
    while (cur <= until && out.length < MAX_OCCURRENCES) {
      push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }

  if (r.mode === "weekly") {
    let cur = start;
    while (cur <= until && out.length < MAX_OCCURRENCES) {
      push(cur);
      cur = addWeeks(cur, 1);
    }
    return out;
  }

  if (r.mode === "monthly") {
    let cur = start;
    while (cur <= until && out.length < MAX_OCCURRENCES) {
      push(cur);
      cur = addMonths(cur, 1);
    }
    return out;
  }

  const weekDays = (r.weekDays ?? []).filter((n) => n >= 0 && n <= 6);
  if (!weekDays.length) return [startDateISO];

  // percorre dia a dia, mas só adiciona se bater no dia da semana escolhido
  let cur = start;
  while (cur <= until && out.length < MAX_OCCURRENCES) {
    const dow = getDay(cur); // 0..6
    if (weekDays.includes(dow)) push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
