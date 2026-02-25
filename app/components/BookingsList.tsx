"use client";

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { MY_AGENDA_ID } from "./RoomList";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { Input } from "@/app/components/ui/input";
import type { Booking } from "@/lib/types/booking";
import { toISODateOnly } from "@/lib/time";
import Delete from "./Delete";
import { ScrollArea, ScrollBar } from "@/app/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";

type Props = {
  roomId: string;
  date: Date;
  reloadKey: number;
  onReload: () => void;
};

const fetcher = (url: string) =>
  fetch(url).then((res) => (res.ok ? res.json() : null));

function ConfirmRescheduleButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => Promise<unknown> | unknown;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    try {
      await toast.promise(Promise.resolve(onConfirm()), {
        loading: "Salvando alteração...",
        success: "Alteração efetuada com sucesso!",
        error: (e) => e?.message || "Erro ao remarcar",
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (loading) return;
    setOpen(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" disabled={disabled}>
          {loading ? "Salvando..." : "Confirmar"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar reagendamento</AlertDialogTitle>
          <AlertDialogDescription>
            Deseja realmente reagendar este horário?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? "Reagendando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BookingsList({ roomId, date, reloadKey, onReload }: Props) {
  const isoDate = toISODateOnly(date);
  const isMyAgenda = roomId === MY_AGENDA_ID;

  // Key isolada para podermos usar mutate de forma previsível
  const swrKey = isMyAgenda
    ? `/api/bookings?scope=my&date=${isoDate}&_k=${reloadKey}`
    : `/api/bookings?roomId=${roomId}&date=${isoDate}&_k=${reloadKey}`;

  // Pegamos mutate
  const { data: bookings, isLoading, mutate, isValidating } = useSWR<Booking[]>(
    swrKey,
    fetcher,
    {
      // Evita o "pisca" (lista some e volta) ao trocar de sala/data.
      keepPreviousData: true,
    }
  );

  const { data: me } = useSWR<{
    authenticated: boolean;
    user: { email: string; name: string | null; id: string | null } | null;
  }>("/api/auth/me", fetcher);

  const currentEmail =
    me?.authenticated && me.user?.email ? me.user.email.toLowerCase() : null;

  const isAdmin = (me as any)?.authenticated && (me as any)?.user?.role === "admin";

  const [editing, setEditing] = useState<Booking | null>(null);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newDate, setNewDate] = useState(""); // ✅ data nova (YYYY-MM-DD)
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const list = bookings || [];

  function openEdit(b: Booking) {
    setEditing(b);
    setNewStartTime(b.startTime);
    setNewEndTime(b.endTime);
    setNewDate(b.date);
    setError(null);
  }

  async function handleUpdate() {
    if (!editing) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Erro ao remarcar");
      }

      setEditing(null);

      // Revalida a lista imediatamente (evita UI desatualizada)
      await mutate();

      // Mantém seu comportamento atual de recarregar o calendário
      onReload();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);

    // 1)remove imediatamente da lista
    await mutate(
      (current) => (current ? current.filter((b) => b.id !== id) : current),
      { revalidate: false }
    );

    // 2) DELETE no backend
    const res = await fetch("/api/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      // rollback: revalida do servidor se der erro
      await mutate();
      throw new Error(json?.error || "Erro ao excluir");
    }

    // 3) revalida para garantir consistência
    await mutate();

    // 4) mantém lógica para atualizar o calendário
    onReload();
  }

  return (
    <div className="space-y-3">
      <div className="text-base text-white">
        {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando reservas...</p>
      )}

      {!isLoading && isValidating && (
        <p className="text-xs text-muted-foreground">Atualizando…</p>
      )}

      {!isLoading && list.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum horário reservado para este dia.
        </p>
      )}

      <ScrollArea className="h-[calc(100vh-220px)] pr-3.5">
        <div className="flex flex-col gap-2">
          {list.map((b) => {
            const isOwner =
              currentEmail &&
              b.userEmail.toLowerCase() === currentEmail.toLowerCase();
            const canManage = !!isAdmin || !!isOwner;
            return (
              <Card
                key={b.id}
                className="
                  w-full min-w-0
                  flex items-start justify-between gap-3
                  rounded-xl
                  px-3 py-3
                  shadow-sm
                "
              >
                <div className="flex flex-col p-0 min-w-0 flex-1">
                  <div className="flex flex-col min-w-0 w-full">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="min-w-0 w-full">
                            <div className="flex items-center gap-2 min-w-0 w-full mb-2">
                              <span className="font-bold text-[14px] leading-snug break-words line-clamp-2">
                                {b.title}
                              </span>
                            </div>

                            {isMyAgenda && (
                              <div className="text-[14px]">
                                <span className="font-semibold">
                                  Sala:
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {b.roomName || "-"}
                                </span>
                              </div>
                            )}

                            <span className="text-[13px] flex gap-1">
                              <span className="font-semibold">
                                Horário:
                              </span>

                              <span className="text-muted-foreground">
                                {b.startTime} às {b.endTime}
                              </span>
                            </span>
                          </div>
                        </TooltipTrigger>

                        <TooltipContent>
                          <p className="max-w-[320px] wrap-break-word">
                            {b.title}
                            {b.roomName ? ` | Sala: ${b.roomName}` : ""}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="flex flex-col text-[13px]">
                    <div className="flex gap-1">
                      <span className="font-semibold">
                        Responsável:
                      </span>
                      <span className="text-muted-foreground">{b.userName}</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="font-semibold">
                        Origem:
                      </span>
                      <span className="text-muted-foreground">
                        {((b as any)?.provider === "ics"
                          ? "Importação"
                          : (b as any)?.provider === "google"
                            ? "Google"
                            : "Local")}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const normalize = (v?: string | null) =>
                      (v ?? "").trim().toLowerCase();

                    const userEmailLower = normalize(currentEmail);

                    const raw = (b as any)?.participantsEmails;

                    const participantsArray: string[] = Array.isArray(raw)
                      ? raw
                        .map((e) => normalize(String(e)))
                        .filter(Boolean)
                      : typeof raw === "string"
                        ? raw
                          .split(/[,;\n]/g)
                          .map((e) => normalize(e))
                          .filter(Boolean)
                        : [];

                    const ownerEmailLower = normalize((b as any)?.userEmail);
                    const isOwner =
                      !!userEmailLower && userEmailLower === ownerEmailLower;

                    const isParticipant =
                      !!userEmailLower &&
                      participantsArray.includes(userEmailLower);

                    if (!(isOwner || isParticipant)) return null;

                    return (
                      <div className="flex flex-col gap-1">
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
                          <span className=" text-sm italic text-muted-foreground text-center">
                            Nenhum participante listado
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Remarcar"
                      onClick={() => openEdit(b)}
                      className="cursor-pointer shrink-0"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>

                    <Delete
                      onConfirm={() => handleDelete(b.id)}
                      title="Cancelar agendamento"
                      description="Tem certeza que deseja cancelar este agendamento?"
                      loadingText="Cancelando..."
                      successText="Cancelado com sucesso!"
                      errorText="Erro ao cancelar"
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remarcar reserva</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {editing.userName} ({editing.userEmail})<br />
                Data atual:{" "}
                {format(new Date(editing.date + "T00:00:00"), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </div>

              {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
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
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              type="button"
            >
              Cancelar
            </Button>

            <ConfirmRescheduleButton disabled={saving} onConfirm={handleUpdate} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && !editing && (
        <p className="text-xs text-red-500 text-center mt-2">{error}</p>
      )}
    </div>
  );
}
