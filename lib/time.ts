// lib/time.ts
import { WORK_START_MIN, WORK_END_MIN } from "./rooms";
import { format } from "date-fns";

export function timeToMinutes(t: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(t);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

export function roundMinutesToNearestTen(totalMinutes: number): number {
  // 1. Divida por 10: (Ex: 78 / 10 = 7.8)
  // 2. Arredonde para o número inteiro mais próximo: (Ex: round(7.8) = 8)
  // 3. Multiplique por 10: (Ex: 8 * 10 = 80)
  return Math.round(totalMinutes / 10) * 10;
}

export function isWithinWorkingHours(start: string, end: string): boolean {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return false;
  if (s >= e) return false;
  return s >= WORK_START_MIN && e <= WORK_END_MIN;
}

export function intervalsOverlap(
  s1: string,
  e1: string,
  s2: string,
  e2: string
): boolean {
  const a1 = timeToMinutes(s1);
  const a2 = timeToMinutes(e1);
  const b1 = timeToMinutes(s2);
  const b2 = timeToMinutes(e2);
  if (a1 === null || a2 === null || b1 === null || b2 === null) return false;
  return a1 < b2 && b1 < a2;
}

export function toISODateOnly(date: Date): string {
  // Usa timezone local (evita "pular" um dia por conversão UTC)
  return format(date, "yyyy-MM-dd");
}
