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
  MessageSquare,
  RotateCcw,
  UserMinus,
  Users,
} from "lucide-react";

import type { Booking } from "@/lib/types/booking";
import { PERSONAL_ROOM_ID, ROOMS } from "@/lib/rooms";
import ImportPage from "@/app/import/page";

import { BookingForm } from "./BookingForm";
import { BookingsList } from "./BookingsList";
import { MonthGrid } from "./MonthGrid";
import { MY_AGENDA_ID, RoomList } from "./RoomList";
import { DraggablePanel } from "./DraggablePanel";
import { AvatarProfile } from "./AvatarProfile";
import { CalendarDayIcon } from "./CalendarIcon";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import { TimeGrid } from "./TimeGrid";
import { AppSidebar } from "./AppSidebar";
import { ManageGuestsDialog } from "./ManageGuestsDialog";
import { BookingRequestDialog } from "./BookingRequestDialog";
import { NotificationBell } from "./NotificationBell";
import { revalidateNotifications } from "@/app/components/notifications-cache";

import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Calendar } from "@/app/components/ui/calendar";
import { Input } from "@/app/components/ui/input";
import { SidebarTrigger } from "@/app/components/ui/sidebar";
import Delete from "./Delete";
import { toISODateOnly } from "@/lib/time";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import Logo from "./Logo";

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

export function SchedulePage() {
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>("month");
  const [roomId, setRoomId] = useState<string | undefined>(undefined);

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
  const [manageGuestsOpen, setManageGuestsOpen] = useState(false);
  const [requestType, setRequestType] = useState<"reschedule" | "decline" | null>(null);
  const [actionBooking, setActionBooking] = useState<Booking | null>(null);

  // CHAVE de recarga REAL para a BookingsList (não usar 0 fixo)
  const [reloadKey, setReloadKey] = useState(0);

  const isMyAgenda = roomId === MY_AGENDA_ID;
  const visibleRooms = useMemo(() => ROOMS.filter((room) => room.id !== PERSONAL_ROOM_ID), []);

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

  const isAdmin = me?.authenticated && me.user?.role === "admin";

  function handleRoomChange(nextRoomId?: string) {
    // Fecha painéis/diálogos imediatamente ao trocar de sala (evita "vazar" detalhes)
    setBookingPanelOpen(false);
    setDetailsBooking(null);
    setRescheduleOpen(false);
    setManageGuestsOpen(false);
    setRequestType(null);
    setActionBooking(null);
    setDetailsError(null);
    setRoomSwitching(true);
    setRoomId(nextRoomId);
  }

  async function refreshAllAndClosePanels() {
    await Promise.all([mutateBookings(), mutateHolidays(), revalidateNotifications()]);

    setReloadKey((k) => k + 1);

    setBookingPanelOpen(false);
    setDetailsBooking(null);
  }

  async function refreshBookingData() {
    await globalMutate((key) => typeof key === "string" && key.startsWith("/api/bookings"));
    await Promise.all([mutateBookings(), mutateHolidays(), revalidateNotifications()]);
    setReloadKey((k) => k + 1);
  }

  async function handleGuestsUpdated(updated: Booking) {
    setActionBooking(updated);
    await refreshBookingData();
  }

  async function handleRequestCreated() {
    setRequestType(null);
    setActionBooking(null);
    await Promise.all([
      globalMutate((key) => typeof key === "string" && key.startsWith("/api/notifications")),
      revalidateNotifications(),
      globalMutate((key) => typeof key === "string" && key.startsWith("/api/booking-requests")),
    ]);
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
      !!detailsBooking?.canManage || !!isAdmin || (
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
    } catch (e: unknown) {
      setDetailsError(e instanceof Error ? e.message : "Erro ao remarcar");
      throw e;
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Button
        className="w-12 h-12 cursor-pointer lg:hidden flex fixed bottom-4 right-4 z-20 rounded-full items-center justify-center shadow-lg"
        onClick={() => {
          setBookingPanelOpen(true);
          setDetailsBooking(null);
        }}
        disabled={!roomId}
      >
        <CalendarPlus className="h-4 w-4" />
      </Button>

      <div className="px-2 py-0 lg:px-4 lg:py-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
          {/* COLUNA ESQUERDA */}
          <div className="">
            <AppSidebar roomId={roomId} onRoomChange={handleRoomChange} />
            <Card className="hidden lg:flex flex-col border-0 shadow-none bg-transparent h-full justify-between p-0 ">
              <div className="flex flex-col gap-2.5">
                <AvatarProfile />

                <Button
                  className="w-full cursor-pointer"
                  onClick={() => {
                    setBookingPanelOpen(true);
                    setDetailsBooking(null);
                  }}
                  disabled={!roomId}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Criar agendamento
                </Button>

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

                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-xl">Salas</h2>
                  <ImportPage></ImportPage>
                </div>

                <RoomList value={roomId} onChange={handleRoomChange} />
              </div>

              <Logo />
            </Card>
          </div>

          {/* COLUNA CENTRAL */}
          <Card className="relative flex min-w-0 flex-col pb-0 pt-4">
            <div className="mx-4 p-0">
              <div className="relative flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <SidebarTrigger className="absolute left-0 top-0 h-9 w-9 lg:hidden" />

                <div className="flex min-w-0 flex-wrap items-center justify-center gap-3 pl-10 xl:justify-start xl:pl-0">
                  <CalendarDayIcon day={dayNumber} />
                  <h1 className="min-w-0 truncate text-xl font-bold tracking-tight md:text-2xl lg:text-3xl xl:text-2xl 2xl:text-4xl">
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

                <div className="flex flex-col items-center gap-2 sm:flex-row xl:justify-end">
                  <div className="flex items-center gap-3">
                    <ChevronLeft
                      onClick={goPrev}
                      className="h-4 w-4 cursor-pointer xl:h-6 xl:w-6"
                    />

                    <span className="min-w-[132px] text-center text-xs font-semibold md:text-[16px] 2xl:text-lg">
                      {format(currentMonth, "MMMM 'de' yyyy", {
                        locale: ptBR,
                      }).replace(/^./, (c) => c.toUpperCase())}
                    </span>

                    <ChevronRight
                      onClick={goNext}
                      className="h-4 w-4 cursor-pointer xl:h-6 xl:w-6"
                    />
                  </div>

                  {isRefreshingData && (
                    <span className="text-xs text-muted-foreground sr-only">Atualizando reservas…</span>
                  )}

                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-1 shadow-sm">
                    <ViewToggle value={view} onChange={setView} />
                    <div className="h-6 w-px bg-border" />
                    <NotificationBell />
                  </div>
                </div>
              </div>
            </div>

            {roomSwitching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                <div className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                  Carregando dados da sala…
                </div>
              </div>
            )}

            {!roomId ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center gap-5 px-4 py-10 text-center">
                <div>
                  <h2 className="text-xl font-semibold">Selecione uma sala</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha a sala inicial para carregar o calendario. Depois disso, use a barra lateral para trocar.
                  </p>
                </div>
                <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleRooms.map((room) => (
                    <Button
                      key={room.id}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start py-3 text-left"
                      onClick={() => handleRoomChange(room.id)}
                    >
                      {room.name}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-auto justify-start py-3 text-left"
                    onClick={() => handleRoomChange(MY_AGENDA_ID)}
                  >
                    Agenda Pessoal
                  </Button>
                </div>
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
          <Card className="flex min-w-0 flex-col gap-3 py-4 pl-4 pr-1 tracking-tight">
            <div className="flex items-center justify-center">
              <h2 className="font-semibold text-xl text-foreground">
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
                {detailsBooking.provider === "ics"
                  ? "Importação"
                  : detailsBooking.provider === "google"
                    ? "Google"
                    : "Local"}
              </p>

              {detailsBooking.longReason && (
                <div className="rounded-md border bg-muted/50 p-2">
                  <p className="font-semibold">Justificativa:</p>
                  <p className="mt-1 text-muted-foreground">{detailsBooking.longReason}</p>
                </div>
              )}

              {(() => {
                const normalize = (v?: string | null) =>
                  (v ?? "").trim().toLowerCase();

                const userEmailLower = normalize(currentEmail);

                const raw = detailsBooking.participantsEmails;

                const participantsArray: string[] = Array.isArray(raw)
                  ? raw.map((e) => normalize(String(e))).filter(Boolean)
                  : typeof raw === "string"
                    ? raw
                      .split(/[,;\n]/g)
                      .map((e) => normalize(e))
                      .filter(Boolean)
                    : [];

                const ownerEmailLower = normalize(detailsBooking.userEmail);
                const isOwner =
                  detailsBooking.isOwner ?? (!!userEmailLower && userEmailLower === ownerEmailLower);

                const isParticipant =
                  detailsBooking.isParticipant ?? (!!userEmailLower && participantsArray.includes(userEmailLower));

                if (!(detailsBooking.canViewParticipants ?? (isOwner || isParticipant))) return null;

                return (
                  <div className="flex flex-col gap-1 pt-2">
                    <span className="font-semibold text-foreground">
                      Participantes:
                    </span>

                    {participantsArray.length > 0 ? (
                      <div className="flex flex-col pl-2 border-l-2 border-border ml-1">
                        {participantsArray.map((email, index) => (
                          <span
                            key={index}
                            className="text-sm text-muted-foreground py-0.5"
                          >
                            {email}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm italic text-muted-foreground pl-2">
                        Nenhum participante listado
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Botões no DETALHE (apenas para o dono) */}
              {detailsIsOwner && (
                <div className="flex flex-wrap gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActionBooking(detailsBooking);
                      setDetailsBooking(null);
                      setManageGuestsOpen(true);
                    }}
                    className="cursor-pointer"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Editar
                  </Button>

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

              {!detailsIsOwner && detailsBooking.isParticipant && (
                <div className="flex flex-wrap gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActionBooking(detailsBooking);
                      setDetailsBooking(null);
                      setRequestType("reschedule");
                    }}
                    className="cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Solicitar remarcacao
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActionBooking(detailsBooking);
                      setDetailsBooking(null);
                      setRequestType("decline");
                    }}
                    className="cursor-pointer"
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Nao vou comparecer
                  </Button>
                </div>
              )}

              {detailsError && (
                <p className="text-xs text-red-500 pt-2">{detailsError}</p>
              )}
            </div>
          )}
        </DraggablePanel>

        <ManageGuestsDialog
          open={manageGuestsOpen}
          booking={actionBooking}
          onOpenChange={(open) => {
            setManageGuestsOpen(open);
            if (!open) setActionBooking(null);
          }}
          onUpdated={handleGuestsUpdated}
        />

        <BookingRequestDialog
          open={!!requestType}
          type={requestType ?? "reschedule"}
          booking={actionBooking}
          onOpenChange={(open) => {
            if (!open) setRequestType(null);
            if (!open) setActionBooking(null);
          }}
          onCreated={handleRequestCreated}
        />

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
