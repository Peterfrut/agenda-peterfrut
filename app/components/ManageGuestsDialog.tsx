"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Search, X } from "lucide-react";
import type { Booking } from "@/lib/types/booking";
import { isValidEmail, normEmail, splitEmails } from "@/lib/formatters";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

type Props = {
  open: boolean;
  booking: Booking | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (booking: Booking) => void;
};

type UserSuggestion = {
  id: string;
  name: string;
  email: string;
};

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

function formatDate(dateISO?: string) {
  if (!dateISO) return "-";
  const [year, month, day] = dateISO.split("-");
  if (!year || !month || !day) return dateISO;
  return `${day}/${month}/${year}`;
}

function emailsToCommaString(list: string[]) {
  const unique = Array.from(new Set(list.map(normEmail).filter(Boolean)));
  return unique.length ? unique.join(",") : null;
}

export function ManageGuestsDialog({ open, booking, onOpenChange, onUpdated }: Props) {
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [longReason, setLongReason] = useState("");
  const [guests, setGuests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booking || !open) return;
    setTitle(booking.title ?? "");
    setLongReason(booking.longReason ?? "");
    setGuests(splitEmails(booking.participantsEmails ?? ""));
    setDraft("");
    setError(null);
  }, [booking, open]);

  const suggestionsKey =
    open && draft.trim().length >= 2 ? `/api/users/search?q=${encodeURIComponent(draft.trim())}` : null;

  const { data: suggestionsData } = useSWR<{ ok: boolean; users: UserSuggestion[] }>(
    suggestionsKey,
    fetcher,
    { keepPreviousData: true }
  );

  const suggestions = useMemo(() => {
    const current = new Set(guests.map(normEmail));
    return (suggestionsData?.users ?? []).filter((user) => !current.has(normEmail(user.email)));
  }, [guests, suggestionsData?.users]);

  function addGuest(raw: string) {
    const email = normEmail(raw);
    if (!email) return;

    if (!isValidEmail(email)) {
      setError("Informe um e-mail valido.");
      return;
    }

    if (booking?.userEmail && normEmail(booking.userEmail) === email) {
      setError("O responsavel ja faz parte da reserva.");
      return;
    }

    setGuests((prev) => {
      if (prev.includes(email)) {
        setError("Este convidado ja foi adicionado.");
        return prev;
      }
      setError(null);
      return [...prev, email];
    });
    setDraft("");
  }

  function removeGuest(email: string) {
    setGuests((prev) => prev.filter((item) => item !== email));
    setError(null);
  }

  async function save() {
    if (!booking || saving) return;

    if (title.trim().length < 1) {
      setError("Informe um titulo para o agendamento.");
      return;
    }

    let nextGuests = guests;
    if (draft.trim()) {
      const email = normEmail(draft);
      if (!isValidEmail(email)) {
        setError("Adicione ou limpe o e-mail digitado antes de salvar.");
        return;
      }
      if (booking.userEmail && normEmail(booking.userEmail) === email) {
        setError("O responsavel ja faz parte da reserva.");
        return;
      }
      nextGuests = guests.includes(email) ? guests : [...guests, email];
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: booking.id,
          title: title.trim(),
          longReason: longReason.trim() || null,
          participantsEmails: emailsToCommaString(nextGuests),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Erro ao atualizar convidados.");

      toast.success("Agendamento atualizado.");
      onUpdated(json as Booking);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar convidados.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-24px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {booking && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">Reserva selecionada</p>
              <div className="mt-2 grid gap-1 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Sala:</span> {booking.roomName}
                </p>
                <p>
                  <span className="font-medium text-foreground">Data:</span> {formatDate(booking.date)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Horario:</span> {booking.startTime} - {booking.endTime}
                </p>
                <p>
                  <span className="font-medium text-foreground">Responsavel:</span> {booking.userName}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium">Titulo</label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              maxLength={120}
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Justificativa</label>
            <textarea
              value={longReason}
              onChange={(e) => {
                setLongReason(e.target.value);
                setError(null);
              }}
              maxLength={600}
              disabled={saving}
              className="min-h-20 w-full resize-y rounded-md border bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Opcional. Use para explicar reservas longas, recorrencias ou contexto importante."
            />
          </div>

          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              placeholder="Buscar usuario ou digitar e-mail externo"
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGuest(draft);
                }
              }}
            />
            <Button type="button" onClick={() => addGuest(draft)} disabled={saving || !draft.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {suggestions.length > 0 && (
            <div className="max-h-44 overflow-auto rounded-md border p-1">
              {suggestions.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => addGuest(user.email)}
                  disabled={saving}
                >
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {guests.length ? (
              guests.map((email) => (
                <div key={email} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{email}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGuest(email)}
                    disabled={saving}
                    aria-label={`Remover ${email}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum convidado adicionado.</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
