"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  format,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

import logo from "@/public/logo_peterfrut.png";

import type { Booking } from "@/lib/types/booking";
import { ROOMS } from "@/lib/rooms";

import { BookingForm } from "./BookingForm";
import { BookingsList } from "./BookingsList";
import { MonthGrid } from "./MonthGrid";
import { MY_AGENDA_ID, RoomList } from "./RoomList";
import { DraggablePanel } from "./DraggablePanel";
import { AvatarProfile } from "./AvatarProfile";
import { CalendarDayIcon } from "./CalendarIcon";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import { TimeGrid } from "./TimeGrid";

import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Calendar } from "@/app/components/ui/calendar";
import { Input } from "@/app/components/ui/input";
import Delete from "./Delete";
import { toISODateOnly } from "@/lib/time";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";

type Holiday = {
  id: string;
  name: string;
  date: string;
  roomId: string | null;
  source?: "national" | string;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Erro ao buscar dados.");
  return j;
};

const DEFAULT_ROOM_ID = MY_AGENDA_ID;

export function SchedulePage() {
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>("month");
  const [roomId, setRoomId] = useState<string | undefined>(DEFAULT_ROOM_ID);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const [bookingPanelOpen, setBookingPanelOpen] = useState(false);
  const [detailsBooking, setDetailsBooking] = useState<Booking | null>(null);

  // Reagendar a partir do painel de detalhes
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  // CHAVE de recarga REAL para a BookingsList (não usar 0 fixo)
  const [reloadKey, setReloadKey] = useState(0);

  const isMyAgenda = roomId === MY_AGENDA_ID;

  // Título dinâmico por sala
  const roomTitle = useMemo(() => {
    if (!roomId) return "Agenda de Salas";
    if (roomId === MY_AGENDA_ID) return "Agenda Pessoal";
    const r = ROOMS.find((x) => x.id === roomId);
    return r?.name || "Agenda de Salas";
  }, [roomId]);

  // URL -> state (sem loop)
  const roomFromUrl = searchParams?.get("roomId") || null;
  const dateFromUrl = searchParams?.get("date") || null;

  useEffect(() => {
    if (roomFromUrl && roomFromUrl !== roomId) handleRoomChange(roomFromUrl);

    if (dateFromUrl) {
      const d = new Date(`${dateFromUrl}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        const currentISO = toISODateOnly(selectedDate);
        if (currentISO !== dateFromUrl) {
          setSelectedDate(d);
          setCurrentMonth(d);
        }
      }
    }
  }, [roomFromUrl, dateFromUrl]);

  const monthStartISO = useMemo(() => {
    return toISODateOnly(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
  }, [currentMonth]);

  const monthEndISO = useMemo(() => {
    return toISODateOnly(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
  }, [currentMonth]);

  const bookingsKey = useMemo(() => {
    if (!roomId) return null;
    if (isMyAgenda) return `/api/bookings?scope=my&_all=1`;
    return `/api/bookings?roomId=${roomId}&_all=1`;
  }, [roomId, isMyAgenda]);

  const holidaysKey = useMemo(() => {
    if (!roomId) return null;
    return `/api/holidays?roomId=${roomId}&start=${monthStartISO}&end=${monthEndISO}`;
  }, [roomId, monthStartISO, monthEndISO]);

  const { data: allBookings = [], mutate: mutateBookings, isValidating: bookingsValidating } = useSWR<Booking[]>(
    bookingsKey,
    fetcher,
    { keepPreviousData: true }
  );

  const { data: holidays = [], mutate: mutateHolidays, isValidating: holidaysValidating } = useSWR<Holiday[]>(
    holidaysKey,
    fetcher,
    { keepPreviousData: true }
  );

  const isRefreshingData = bookingsValidating || holidaysValidating;

  // Evita "piscar" (sumir lista/feriados) durante troca de sala e também impede cliques
  // enquanto os dados da nova sala ainda estão carregando.
  const [roomSwitching, setRoomSwitching] = useState(false);

  useEffect(() => {
    if (!roomSwitching) return;
    if (!isRefreshingData) setRoomSwitching(false);
  }, [roomSwitching, isRefreshingData]);


  const { data: me } = useSWR<{
    authenticated: boolean;
    user: { email: string; name: string | null; id: string | null; role?: string } | null;
  }>("/api/auth/me", fetcher);

  const currentEmail =
    me?.authenticated && me.user?.email ? me.user.email.toLowerCase() : null;

  const isAdmin = (me as any)?.authenticated && (me as any)?.user?.role === "admin";

  function handleRoomChange(nextRoomId?: string) {
    // Fecha painéis/diálogos imediatamente ao trocar de sala (evita "vazar" detalhes)
    setBookingPanelOpen(false);
    setDetailsBooking(null);
    setRescheduleOpen(false);
    setDetailsError(null);
    setRoomSwitching(true);
    setRoomId(nextRoomId);
  }

  async function refreshAllAndClosePanels() {
    await Promise.all([mutateBookings(), mutateHolidays()]);

    setReloadKey((k) => k + 1);

    setBookingPanelOpen(false);
    setDetailsBooking(null);
  }

  const dayNumber = new Date().getDate();

  function goPrev() {
    if (view === "month") setCurrentMonth((d) => subMonths(d, 1));
    if (view === "week") {
      const next = subDays(selectedDate, 7);
      setSelectedDate(next);
      setCurrentMonth(next);
    }
    if (view === "day") {
      const next = subDays(selectedDate, 1);
      setSelectedDate(next);
      setCurrentMonth(next);
    }
  }

  function goNext() {
    if (view === "month") setCurrentMonth((d) => addMonths(d, 1));
    if (view === "week") {
      const next = addDays(selectedDate, 7);
      setSelectedDate(next);
      setCurrentMonth(next);
    }
    if (view === "day") {
      const next = addDays(selectedDate, 1);
      setSelectedDate(next);
      setCurrentMonth(next);
    }
  }

  function goToday() {
    const now = new Date();
    setSelectedDate(now);
    setCurrentMonth(now);
  }

  const selectedISO = toISODateOnly(selectedDate);

  // Semana começa domingo
  const timeGridDays = useMemo(() => {
    if (view === "day") {
      return [
        {
          date: toISODateOnly(selectedDate),
          dayName: format(selectedDate, "EEE.", { locale: ptBR }),
          dayLabel: format(selectedDate, "dd", { locale: ptBR }),
        },
      ];
    }

    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return {
        date: toISODateOnly(d),
        dayName: format(d, "EEE.", { locale: ptBR }),
        dayLabel: format(d, "dd", { locale: ptBR }),
      };
    });
  }, [view, selectedDate]);

  function openBookingFormForDateISO(dateISO: string) {
    const d = new Date(`${dateISO}T00:00:00`);
    setSelectedDate(d);
    setCurrentMonth(d);
    setDetailsBooking(null);
    setBookingPanelOpen(true);
  }

  // ==========
  // AÇÕES NO DETALHE (REAGENDAR/EXCLUIR)
  // ==========

  const detailsIsOwner = useMemo(() => {
    const normalize = (v?: string | null) => (v ?? "").trim().toLowerCase();
    const userEmailLower = normalize(currentEmail);
    const ownerEmailLower = normalize(detailsBooking?.userEmail);
    return (
      !!isAdmin || (
        !!userEmailLower &&
        !!ownerEmailLower &&
        userEmailLower === ownerEmailLower
      )
    );
  }, [currentEmail, detailsBooking, isAdmin]);

  function openRescheduleFromDetails() {
    if (!detailsBooking) return;
    setDetailsError(null);
    setNewDate(detailsBooking.date);
    setNewStartTime(detailsBooking.startTime);
    setNewEndTime(detailsBooking.endTime);
    setRescheduleOpen(true);
  }

  async function handleDeleteFromDetails(id: string) {
    setDetailsError(null);

    const res = await fetch("/api/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error || "Erro ao excluir");
    }

    // invalida qualquer SWR que use /api/bookings (lista + calendário)
    await globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/bookings")
    );

    await refreshAllAndClosePanels();
    setDetailsBooking(null);
  }

  async function handleRescheduleFromDetails() {
    if (!detailsBooking) return;

    setSavingDetails(true);
    setDetailsError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detailsBooking.id,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Erro ao remarcar");
      }

      setRescheduleOpen(false);

      // invalida qualquer SWR que use /api/bookings (lista + calendário)
      await globalMutate(
        (key) => typeof key === "string" && key.startsWith("/api/bookings")
      );

      await refreshAllAndClosePanels();
      setDetailsBooking(null);
    } catch (e: any) {
      setDetailsError(e?.message || "Erro ao remarcar");
      throw e;
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="py-4 px-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
          {/* COLUNA ESQUERDA */}
          <div className="space-y-4">
            <Card className="flex flex-col border-0 shadow-none gap-3 bg-transparent h-full justify-between">
              <div>
                <AvatarProfile />

                <div className="space-y-2 mt-3">
                  <Button
                    className="w-full justify-center gap-2 cursor-pointer"
                    onClick={() => {
                      setBookingPanelOpen(true);
                      setDetailsBooking(null);
                    }}
                    disabled={!roomId}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Criar agendamento
                  </Button>
                </div>

                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setSelectedDate(d);
                    setCurrentMonth(d);
                  }}
                  initialFocus
                  className="w-full"
                />

                <h2 className="font-semibold text-xl">Salas</h2>
                <RoomList value={roomId} onChange={handleRoomChange} />
              </div>

              <div className="w-full flex flex-col items-center justify-center">
                <img src={logo.src} alt="" className="w-26" />
                <p className="text-xs text-muted-foreground text-center">
                  ©{new Date().getFullYear()} Peterfrut – Todos os direitos
                  reservados.
                </p>
              </div>
            </Card>
          </div>

          {/* COLUNA CENTRAL */}
          <Card className="flex flex-col pb-0 pt-4 relative">
            <div className="flex flex-wrap items-center justify-between mx-4 p-0">
              <div className="flex items-center gap-2 justify-between w-full">
                <div className="flex items-center gap-3 self-center">
                  <CalendarDayIcon day={dayNumber} />
                  <h1 className="text-4xl font-bold tracking-tight">
                    {roomTitle}
                  </h1>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 cursor-pointer"
                    onClick={goToday}
                  >
                    Hoje
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <ChevronLeft
                    onClick={goPrev}
                    className="h-6 w-6 cursor-pointer"
                  />

                  <span className="font-semibold text-xl">
                    {format(currentMonth, "MMMM 'de' yyyy", {
                      locale: ptBR,
                    }).replace(/^./, (c) => c.toUpperCase())}
                  </span>

                  {isRefreshingData && (
                    <span className="text-xs text-muted-foreground sr-only">Atualizando reservas…</span>
                  )}

                  <ViewToggle value={view} onChange={setView} />

                  <ChevronRight
                    onClick={goNext}
                    className="h-6 w-6 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {roomSwitching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                <div className="rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground shadow-sm">
                  Carregando dados da sala…
                </div>
              </div>
            )}

            {!roomId ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Selecione uma sala na coluna esquerda para visualizar o
                calendário.
              </div>
            ) : view === "month" ? (
              <MonthGrid
                baseDate={currentMonth}
                bookings={allBookings}
                holidays={holidays}
                selectedDate={selectedDate}
                onDayClick={(d) => {
                  setSelectedDate(d);
                  setCurrentMonth(d);
                }}
                onEmptyAreaClick={(d) => {
                  setSelectedDate(d);
                  setCurrentMonth(d);
                  setBookingPanelOpen(true);
                  setDetailsBooking(null);
                }}
                onEventClick={(booking) => {
                  setDetailsBooking(booking);
                  setBookingPanelOpen(false);
                }}
              />
            ) : (
              <TimeGrid
                days={timeGridDays}
                bookings={allBookings}
                holidays={holidays}
                selectedDateISO={selectedISO}
                onDaySelect={(dateISO) => {
                  const d = new Date(`${dateISO}T00:00:00`);
                  setSelectedDate(d);
                  setCurrentMonth(d);
                }}
                onEmptyClick={(dateISO) => openBookingFormForDateISO(dateISO)}
                onEventClick={(b) => {
                  setDetailsBooking(b);
                  setBookingPanelOpen(false);
                }}
              />
            )}

            {/* Overlay para evitar cliques durante troca de sala e impedir "pisca"/interações erradas */}
            {roomId && roomSwitching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                <div className="text-sm text-muted-foreground">Carregando dados da sala…</div>
              </div>
            )}
          </Card>

          {/* COLUNA DIREITA */}
          <Card className="py-4 pl-4 pr-1 tracking-tight flex flex-col gap-3 bg-zinc-950">
            <div className="flex items-center justify-center">
              <h2 className="font-semibold text-xl text-white">
                Horários Agendados
              </h2>
            </div>

            {roomId ? (
              <BookingsList
                roomId={roomId}
                date={selectedDate}
                reloadKey={reloadKey}
                onReload={refreshAllAndClosePanels}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione uma sala para ver os agendamentos do dia.
              </p>
            )}
          </Card>
        </div>

        {/* Painel NOVO agendamento */}
        <DraggablePanel
          open={bookingPanelOpen}
          onClose={() => setBookingPanelOpen(false)}
          title={`Novo agendamento · ${roomTitle} · ${format(
            selectedDate,
            "dd/MM/yyyy"
          )}`}
        >
          {roomId ? (
            <BookingForm
              roomId={roomId}
              date={selectedDate}
              onDateChange={(next) => {
                setSelectedDate(next);
                setCurrentMonth(next);
              }}
              onCreated={refreshAllAndClosePanels}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione uma sala na coluna esquerda para poder agendar.
            </p>
          )}
        </DraggablePanel>

        {/* Painel DETALHES */}
        <DraggablePanel
          open={!!detailsBooking}
          onClose={() => {
            setDetailsBooking(null);
            setDetailsError(null);
          }}
          title={`Detalhes da Reserva`}
          initialPosition={{ x: 520, y: 180 }}
        >
          {detailsBooking && (
            <div className="space-y-2 text-sm">
              <p className="text-xl font-bold">{detailsBooking.title}</p>

              <p>
                <span className="font-semibold">Sala:</span>{" "}
                {detailsBooking.roomName}
              </p>

              <p>
                <span className="font-semibold">Data:</span>{" "}
                {format(
                  new Date(detailsBooking.date + "T00:00:00"),
                  "dd/MM/yyyy"
                )}
              </p>

              <p>
                <span className="font-semibold">Horário:</span>{" "}
                {detailsBooking.startTime} – {detailsBooking.endTime}
              </p>

              <p>
                <span className="font-semibold">Responsável:</span>{" "}
                {detailsBooking.userName}
              </p>

              <p>
                <span className="font-semibold">Origem:</span>{" "}
                {(detailsBooking as any)?.provider === "ics"
                  ? "Importação"
                  : (detailsBooking as any)?.provider === "google"
                    ? "Google"
                    : "Local"}
              </p>

              {(() => {
                const normalize = (v?: string | null) =>
                  (v ?? "").trim().toLowerCase();

                const userEmailLower = normalize(currentEmail);

                const raw = (detailsBooking as any)?.participantsEmails;

                const participantsArray: string[] = Array.isArray(raw)
                  ? raw.map((e) => normalize(String(e))).filter(Boolean)
                  : typeof raw === "string"
                  ? raw
                      .split(/[,;\n]/g)
                      .map((e) => normalize(e))
                      .filter(Boolean)
                  : [];

                const ownerEmailLower = normalize((detailsBooking as any)?.userEmail);
                const isOwner =
                  !!userEmailLower && userEmailLower === ownerEmailLower;

                const isParticipant =
                  !!userEmailLower &&
                  participantsArray.includes(userEmailLower);

                if (!(isOwner || isParticipant)) return null;

                return (
                  <div className="flex flex-col gap-1 pt-2">
                    <span className="font-semibold text-gray-900">
                      Participantes:
                    </span>

                    {participantsArray.length > 0 ? (
                      <div className="flex flex-col pl-2 border-l-2 border-blue-100 ml-1">
                        {participantsArray.map((email, index) => (
                          <span
                            key={index}
                            className="text-sm text-gray-600 py-0.5"
                          >
                            {email}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm italic text-gray-500 pl-2">
                        Nenhum participante listado
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Botões no DETALHE (apenas para o dono) */}
              {detailsIsOwner && (
                <div className="flex gap-2 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={openRescheduleFromDetails}
                    className="cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reagendar
                  </Button>

                  <Delete
                    onConfirm={() => handleDeleteFromDetails(detailsBooking.id)}
                    title="Cancelar agendamento"
                    description="Tem certeza que deseja cancelar este agendamento?"
                    loadingText="Cancelando..."
                    successText="Cancelado com sucesso!"
                    errorText="Erro ao cancelar"
                  />
                </div>
              )}

              {detailsError && (
                <p className="text-xs text-red-500 pt-2">{detailsError}</p>
              )}
            </div>
          )}
        </DraggablePanel>

        {/* Modal REAGENDAR (aberto a partir do detalhe) */}
        <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reagendar reserva</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {detailsBooking && (
                <div className="text-xs text-muted-foreground">
                  {detailsBooking.userName} ({detailsBooking.userEmail})
                  <br />
                  Reserva atual:{" "}
                  {format(
                    new Date(detailsBooking.date + "T00:00:00"),
                    "dd/MM/yyyy",
                    { locale: ptBR }
                  )}{" "}
                  · {detailsBooking.startTime}–{detailsBooking.endTime}
                </div>
              )}

              {detailsError && (
                <p className="text-xs text-red-500 text-center">{detailsError}</p>
              )}

              <div>
                <label className="block text-xs mb-1">Nova data</label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1">Início</label>
                  <Input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    step={1800}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Fim</label>
                  <Input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    step={1800}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRescheduleOpen(false)}
                disabled={savingDetails}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={handleRescheduleFromDetails}
                disabled={savingDetails}
              >
                {savingDetails ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}