"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";

import { ROOMS, PERSONAL_ROOM_ID } from "@/lib/rooms";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

export default function ImportIcsAdminPage() {
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
    if (!roomId) return toast.error("Selecione uma sala.");
    if (!file) return toast.error("Selecione um arquivo .ics.");
    if (!file.name.toLowerCase().endsWith(".ics")) return toast.error("O arquivo precisa ser .ics");

    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("roomId", roomId);
      fd.append("file", file);

      const res = await fetch("/api/import/import-ics", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Falha ao importar .ics");
      }

      setResult(json);
      toast.success(
        `Importação concluída: +${json.imported} novos, ${json.updated} atualizados, ${json.skipped} ignorados.`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin · Importar agenda (.ics)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sala</Label>
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
            />
            <p className="text-xs text-muted-foreground">
              Exporte o calendário da conta da sala e envie aqui. Reimportações não duplicam (usamos UID).
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={onSubmit} disabled={loading}>
              {loading ? "Importando..." : "Importar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              disabled={loading}
            >
              Limpar
            </Button>
          </div>

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
        </CardContent>
      </Card>
    </div>
  );
}
