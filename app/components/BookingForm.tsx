"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Alert, AlertDescription } from "@/app/components/ui/alert";

import {
  minutesToTime,
  timeToMinutes,
  toISODateOnly,
  isWithinWorkingHours,
} from "@/lib/time";
import { isValidEmail } from "@/lib/formatters";
import { WORK_END_MIN, WORK_START_MIN } from "@/lib/rooms";
import { MY_AGENDA_ID } from "./RoomList";

import { Plus, Users } from "lucide-react";

type Props = {
  roomId: string;
  date: Date;
  onDateChange?: (next: Date) => void;
  onCreated: () => void;
};

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

/** Converte lista de emails em string "a@a.com, b@b.com" para manter compatibilidade com API atual */
function emailsToCommaString(list: string[]): string | null {
  const unique = Array.from(new Set(list.map(normalizeEmail).filter(Boolean)));
  return unique.length ? unique.join(", ") : null;
}

export function BookingForm({ roomId, date, onDateChange, onCreated }: Props) {
  const { mutate } = useSWRConfig();

  const [bookingDateISO, setBookingDateISO] = useState<string>(() => toISODateOnly(date));

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // -------------------------
  // NOVA LÓGICA PARTICIPANTES
  // -------------------------
  const [showParticipants, setShowParticipants] = useState(false);
  const [participantDraft, setParticipantDraft] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  function addParticipant(raw: string) {
    const email = normalizeEmail(raw);
    if (!email) return;

    if (!isValidEmail(email)) {
      setParticipantsError("Complete o e-mail corretamente.");
      return;
    }

    setParticipants((prev) => {
      const exists = prev.includes(email);
      if (exists) {
        setParticipantsError("Esse e-mail já foi adicionado.");
        return prev;
      }
      setParticipantsError(null);
      return [...prev, email];
    });

    setParticipantDraft("");
  }

  function removeParticipant(email: string) {
    setParticipants((prev) => prev.filter((x) => x !== email));
    setParticipantsError(null);
  }

  // Se usuário apagar todos, opcionalmente esconder o bloco:
  // useEffect(() => {
  //   if (participants.length === 0 && showParticipants) setShowParticipants(false);
  // }, [participants.length, showParticipants]);

  // -------------------------

  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("06:30");
  const [title, setTitle] = useState("");

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: me, isLoading: meLoading } = useSWR<{
    authenticated: boolean;
    user: { email: string; name: string | null; id: string | null } | null;
  }>("/api/auth/me", fetcher);

  const [repeatMode, setRepeatMode] = useState<
    "none" | "daily" | "weekly" | "monthly" | "weeklyByDay"
  >("none");
  const [repeatUntil, setRepeatUntil] = useState<string>(() => toISODateOnly(date));
  const [weekDays, setWeekDays] = useState<number[]>([]); // 0..6

  useEffect(() => {
    if (me?.user) {
      setUserName(me.user.name ?? "");
      setUserEmail(normalizeEmail(me.user.email ?? ""));
    }
  }, [me]);

  useEffect(() => {
    const iso = toISODateOnly(date);
    setBookingDateISO(iso);
    setRepeatUntil(iso);
  }, [date]);

  const bookingsKey = roomId
    ? roomId === MY_AGENDA_ID
      ? `/api/bookings?scope=my&date=${bookingDateISO}`
      : `/api/bookings?roomId=${roomId}&date=${bookingDateISO}`
    : null;

  const { data: dayBookings = [] } = useSWR<any[]>(bookingsKey, fetcher, {
    keepPreviousData: true,
  });

  function overlapsAny(start: string, end: string): boolean {
    const s = timeToMinutes(start);
    const e = timeToMinutes(end);
    if (s === null || e === null) return true;
    return (dayBookings ?? []).some((b) => {
      const bs = timeToMinutes(String(b?.startTime ?? ""));
      const be = timeToMinutes(String(b?.endTime ?? ""));
      if (bs === null || be === null) return false;
      return s < be && bs < e;
    });
  }

  const SLOT_STEP_MIN = 30;

  function buildStartOptions(): string[] {
    const out: string[] = [];
    for (let m = WORK_START_MIN; m <= WORK_END_MIN - SLOT_STEP_MIN; m += SLOT_STEP_MIN) {
      const s = minutesToTime(m);
      const e = minutesToTime(m + SLOT_STEP_MIN);
      if (!overlapsAny(s, e)) out.push(s);
    }
    return out;
  }

  function buildEndOptions(forStart: string): string[] {
    const sMin = timeToMinutes(forStart);
    if (sMin === null) return [];

    const out: string[] = [];
    for (let m = sMin + SLOT_STEP_MIN; m <= WORK_END_MIN; m += SLOT_STEP_MIN) {
      const e = minutesToTime(m);
      if (overlapsAny(forStart, e)) break;
      out.push(e);
    }
    return out;
  }

  useEffect(() => {
    const starts = buildStartOptions();
    if (starts.length === 0) {
      setStartTime("06:00");
      setEndTime("06:30");
      return;
    }

    const nextStart = starts.includes(startTime) ? startTime : starts[0];
    if (nextStart !== startTime) setStartTime(nextStart);

    const ends = buildEndOptions(nextStart);
    const nextEnd =
      ends.includes(endTime) ? endTime : ends[0] ?? minutesToTime(timeToMinutes(nextStart)! + SLOT_STEP_MIN);
    if (nextEnd !== endTime) setEndTime(nextEnd);
  }, [roomId, bookingDateISO, (dayBookings ?? []).length]);

  const disabled = loading || meLoading || !me?.user;

  function revalidateCalendar() {
    mutate((key) => typeof key === "string" && key.startsWith("/api/bookings"));
    mutate((key) => typeof key === "string" && key.startsWith("/api/holidays"));
  }

  async function createBookingInternal(): Promise<{ ok: true } | { ok: false; message: string }> {
    const recurrence =
      repeatMode === "none"
        ? undefined
        : {
            mode: repeatMode,
            until: repeatUntil,
            weekDays: repeatMode === "weeklyByDay" ? weekDays : undefined,
          };

    const participantsEmails = emailsToCommaString(participants);

    const payload = {
      roomId,
      userName: userName.trim(),
      userEmail,
      participantsEmails,
      date: bookingDateISO,
      startTime,
      endTime,
      title: title.trim(),
      recurrence,
    };

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, message: json?.error || "Erro ao salvar reserva." };
    }

    await new Promise((r) => setTimeout(r, 500));
    return { ok: true };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setFormError(null);

    if (!title.trim()) {
      setFormError("Informe um título antes de reservar.");
      return;
    }
    if (!userName.trim()) {
      setFormError("Não foi possível obter seu nome do usuário logado.");
      return;
    }
    if (!userEmail.trim()) {
      setFormError("Não foi possível obter seu e-mail do usuário logado.");
      return;
    }
    if (!isWithinWorkingHours(startTime, endTime)) {
      setFormError("Horário fora do expediente (06:00 às 17:30).");
      return;
    }

    if (repeatMode === "weeklyByDay" && weekDays.length === 0) {
      setFormError("Selecione ao menos um dia da semana para repetir.");
      return;
    }

    // Se o bloco está aberto e existe texto digitado, tenta adicionar antes de enviar
    if (showParticipants && participantDraft.trim()) {
      const email = normalizeEmail(participantDraft);
      if (!isValidEmail(email)) {
        setFormError("Complete o e-mail do participante corretamente ou limpe o campo.");
        return;
      }
      // adiciona e limpa
      setParticipants((prev) => (prev.includes(email) ? prev : [...prev, email]));
      setParticipantDraft("");
    }

    setLoading(true);

    try {
      const promise = createBookingInternal();

      toast.promise(promise, {
        loading: "Reservando...",
        success: (r) => (r.ok ? "Reserva feita com sucesso!" : "Não foi possível reservar."),
        error: "Erro ao salvar reserva no servidor",
      });

      const result = await promise;

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      revalidateCalendar();
      onCreated();
    } catch (err: any) {
      setFormError(err?.message ?? "Erro ao salvar no servidor.");
    } finally {
      setLoading(false);
    }
  }

  const startOptions = buildStartOptions();
  const endOptions = buildEndOptions(startTime);
  const noSlots = startOptions.length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md p-2 bg-card">
      <div className="space-y-2">
        <label className="text-sm font-medium">Título</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Reunião comercial, Viagem, Apresentação..."
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Data</label>
        <Input
          type="date"
          value={bookingDateISO}
          onChange={(e) => {
            const nextISO = e.target.value;
            setBookingDateISO(nextISO);
            setRepeatUntil(nextISO);
            if (onDateChange) {
              const nextDate = new Date(`${nextISO}T00:00:00`);
              if (!Number.isNaN(nextDate.getTime())) onDateChange(nextDate);
            }
          }}
          disabled={disabled}
          className="cursor-pointer"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Seu nome</label>
        <Input value={userName} disabled placeholder="Carregando usuário..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Seu e-mail</label>
        <Input type="email" value={userEmail} disabled placeholder="Carregando usuário..." />
      </div>

      {/* PARTICIPANTES (NOVO) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{`Convidados (Opcional)`}</label>
        {!showParticipants ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled}
            onClick={() => setShowParticipants(true)}
          >
            <Users></Users>
            Adicionar Convidados
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={participantDraft}
                onChange={(e) => {
                  setParticipantDraft(e.target.value);
                  if (participantsError) setParticipantsError(null);
                }}
                placeholder="Digite o e-mail..."
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addParticipant(participantDraft);
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => addParticipant(participantDraft)}
                disabled={disabled || !participantDraft.trim()}
                className="px-3 bg-none"
                aria-label="Adicionar participante"
                title="Adicionar"
              >
                <Plus></Plus>
              </Button>
            </div>

            {participantsError && <p className="text-xs text-red-500">{participantsError}</p>}

            {participants.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {participants.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeParticipant(email)}
                      className="text-xs opacity-70 hover:opacity-100"
                      disabled={disabled}
                      aria-label={`Remover ${email}`}
                      title="Remover"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum participante adicionado.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Início</label>
          <select
            className="w-full rounded-md border bg-background p-2 text-sm cursor-pointer"
            value={startTime}
            onChange={(e) => {
              const nextStart = e.target.value;
              setStartTime(nextStart);
              const ends = buildEndOptions(nextStart);
              const nextEnd = ends[0] ?? minutesToTime(timeToMinutes(nextStart)! + SLOT_STEP_MIN);
              setEndTime(nextEnd);
            }}
            disabled={disabled || noSlots}
          >
            {noSlots ? (
              <option value={startTime}>Sem horários disponíveis</option>
            ) : (
              startOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Fim</label>
          <select
            className="w-full rounded-md border bg-background p-2 text-sm cursor-pointer"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={disabled || endOptions.length === 0}
          >
            {endOptions.length === 0 ? (
              <option value={endTime}>—</option>
            ) : (
              endOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Repetição</label>
          <select
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={repeatMode}
            onChange={(e) => setRepeatMode(e.target.value as any)}
            disabled={disabled}
          >
            <option value="none">Não repetir</option>
            <option value="daily">Diariamente</option>
            <option value="weekly">Semanalmente</option>
            <option value="monthly">Mensalmente</option>
            <option value="weeklyByDay">Dias da semana…</option>
          </select>
        </div>

        {repeatMode !== "none" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Repetir até</label>
            <Input
              type="date"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
              disabled={disabled}
            />
          </div>
        )}

        {repeatMode === "weeklyByDay" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Dias da semana</label>
            <div className="flex flex-wrap gap-2">
              {[
                { k: 0, t: "Dom" },
                { k: 1, t: "Seg" },
                { k: 2, t: "Ter" },
                { k: 3, t: "Qua" },
                { k: 4, t: "Qui" },
                { k: 5, t: "Sex" },
                { k: 6, t: "Sáb" },
              ].map((d) => (
                <label key={d.k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={weekDays.includes(d.k)}
                    onChange={(e) => {
                      setWeekDays((prev) =>
                        e.target.checked ? [...prev, d.k] : prev.filter((x) => x !== d.k)
                      );
                    }}
                    disabled={disabled}
                  />
                  {d.t}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {formError && (
        <Alert variant="destructive" className="bg-(#FEE2E2] border-[#FCA5A5] text-[#EF4444]">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={disabled || !!participantsError || noSlots}
        className="w-full cursor-pointer"
      >
        {loading ? "Reservando..." : "Reservar"}
      </Button>
    </form>
  );
}
