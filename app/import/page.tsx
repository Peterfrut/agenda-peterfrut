"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";

import { ROOMS, PERSONAL_ROOM_ID } from "@/lib/rooms";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { FolderUp, CalendarArrowUp, Presentation } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

export default function ImportPage() {
  const router = useRouter();
  const { data: me } = useSWR<{
    authenticated: boolean;
    user: { email: string; name: string | null; id: string | null; role?: string } | null;
  }>("/api/auth/me", fetcher);

  const rooms = useMemo(() => ROOMS.filter((r) => r.id !== PERSONAL_ROOM_ID), []);

  const [roomId, setRoomId] = useState<string>(rooms[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!me) return;
    if (!me.authenticated) router.replace("/login");
    else if (me.user?.role !== "admin") router.replace("/");
  }, [me, router]);

  async function onSubmit() {
    if (!roomId) throw new Error("Selecione uma sala.");
    if (!file) throw new Error("Selecione um arquivo .ics.");
    if (!file.name.toLowerCase().endsWith(".ics")) throw new Error("O arquivo precisa ser .ics");

    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("roomId", roomId);
    fd.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || "Falha ao importar .ics");

      setResult(json);
      return json;
    } finally {
      setLoading(false);
    }
  }

  const [open, setOpen] = useState(false)

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        <form>
          <DialogTrigger asChild>
            <Button variant="default" type="button" className="rounded-md bg-transparent h-6 cursor-pointer focus:outline-none hover:border-muted hover:bg-secondary hover:text-secondary-foreground text-secondary-foreground text-xs">
              <FolderUp className="w-5 h-5" />
              <span>Importar</span>
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader className="flex">
              <div className="flex flex-row items-center gap-2">
              <CalendarArrowUp className="w-10 h-10 " />
              <DialogTitle>Importar Eventos</DialogTitle>
              </div>
                <DialogDescription>Importe eventos de um arquivo .ics para uma sala específica.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Presentation className="w-6 h-6" />
                <Label>Sala</Label>
              </div>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a sala" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arquivo .ics</Label>
              <input
                type="file"
                accept=".ics,text/calendar"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="bg-primary-foreground p-2 rounded-md text-sm w-fit border border-muted focus:outline-none cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Exporte o calendário da conta da sala e envie aqui. Reimportações não duplicam (usamos UID).
              </p>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                  }}
                  disabled={loading}
                >
                  Limpar
                </Button>
              </DialogClose>

              <Button
                variant="default"
                type="button"
                disabled={loading}
                onClick={() => {
                  toast.promise(onSubmit(), {
                    loading: "Importando eventos...",
                    success: (json: any) => {
                      // fecha somente no sucesso
                      setOpen(false);

                      return `Importação concluída: +${json.imported ?? json.inserted ?? 0} novos, ${json.updated ?? 0
                        } atualizados, ${json.skipped ?? 0} ignorados.`;
                    },
                    error: (e: any) => e?.message ?? "Erro ao importar",
                  });
                }}
              >
                {loading ? "Importando..." : "Importar"}
              </Button>
            </DialogFooter>

            {result ? (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div>
                  <b>Sala:</b> {result.roomName}
                </div>
                {result.sourceCalendar ? (
                  <div>
                    <b>Calendário:</b> {result.sourceCalendar}
                  </div>
                ) : null}
                <div>
                  <b>Novos:</b> {result.imported} · <b>Atualizados:</b> {result.updated} · <b>Ignorados:</b> {result.skipped}
                </div>
                {Array.isArray(result.errors) && result.errors.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer">Ver erros ({result.errors.length})</summary>
                    <ul className="list-disc pl-5 mt-2">
                      {result.errors.map((er: any, idx: number) => (
                        <li key={idx}>
                          {er.uid ? <span className="font-mono">{er.uid}</span> : "(sem UID)"}: {er.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </form>
      </Dialog>
    </div>
  );
}
