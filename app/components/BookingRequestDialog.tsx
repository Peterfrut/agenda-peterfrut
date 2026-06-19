"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Booking } from "@/lib/types/booking";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

type RequestType = "reschedule" | "decline";

type Props = {
  open: boolean;
  type: RequestType;
  booking: Booking | null;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function BookingRequestDialog({ open, type, booking, onOpenChange, onCreated }: Props) {
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedStartTime, setRequestedStartTime] = useState("");
  const [requestedEndTime, setRequestedEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booking || !open) return;
    setRequestedDate(booking.date);
    setRequestedStartTime(booking.startTime);
    setRequestedEndTime(booking.endTime);
    setDescription("");
    setError(null);
  }, [booking, open]);

  async function submit() {
    if (!booking || saving) return;

    if (description.trim().length < 5) {
      setError("Informe uma observacao com pelo menos 5 caracteres.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/booking-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          type,
          requestedDate: type === "reschedule" ? requestedDate : undefined,
          requestedStartTime: type === "reschedule" ? requestedStartTime : undefined,
          requestedEndTime: type === "reschedule" ? requestedEndTime : undefined,
          description: description.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Erro ao enviar solicitacao.");

      toast.success("Solicitacao enviada.");
      onCreated();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao enviar solicitacao.");
    } finally {
      setSaving(false);
    }
  }

  const title = type === "reschedule" ? "Solicitar remarcacao" : "Avisar que nao vou comparecer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-24px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {type === "reschedule" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium">Data sugerida</label>
                <Input type="date" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">Inicio</label>
                  <Input
                    type="time"
                    step={1800}
                    value={requestedStartTime}
                    onChange={(e) => setRequestedStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Fim</label>
                  <Input
                    type="time"
                    step={1800}
                    value={requestedEndTime}
                    onChange={(e) => setRequestedEndTime(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium">Observacao</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="min-h-24 w-full resize-y rounded-md border bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={
                type === "reschedule"
                  ? "Explique por que precisa remarcar e sugira o melhor horario."
                  : "Explique brevemente por que nao podera comparecer."
              }
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
