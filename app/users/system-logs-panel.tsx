"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  FileClock,
  KeyRound,
  Search,
  ShieldAlert,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

type AuditLogRow = {
  id: string;
  action: string;
  category: string;
  severity: string;
  actorName: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
};

type AuditLogCategory = {
  id: string;
  label: string;
  count: number;
};

type AuditLogResponse = {
  ok: boolean;
  logs: AuditLogRow[];
  categories: AuditLogCategory[];
};

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (res) => {
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message || "Erro ao carregar logs");
    return body;
  });

const CATEGORY_OPTIONS = [
  { id: "all", label: "Todos", icon: FileClock },
  { id: "auth", label: "Acessos", icon: KeyRound },
  { id: "users", label: "Usuarios", icon: UsersRound },
  { id: "bookings", label: "Agendamentos", icon: CalendarDays },
  { id: "requests", label: "Solicitacoes", icon: Activity },
  { id: "import", label: "Importacoes", icon: UploadCloud },
  { id: "system", label: "Sistema", icon: ShieldAlert },
];

const ACTION_LABELS: Record<string, string> = {
  "auth.login_success": "Login realizado",
  "auth.login_failed": "Falha de login",
  "auth.login_blocked": "Login bloqueado",
  "auth.logout": "Logout",
  "auth.email_verified": "E-mail verificado",
  "auth.password_reset_requested": "Reset de senha solicitado",
  "auth.password_reset_completed": "Senha redefinida",
  "users.registered": "Usuario cadastrado",
  "users.updated": "Usuario atualizado",
  "users.deleted": "Usuario excluido",
  "bookings.created": "Agendamento criado",
  "bookings.details_updated": "Agendamento editado",
  "bookings.rescheduled": "Agendamento remarcado",
  "bookings.deleted": "Agendamento excluido",
  "requests.decline_created": "Ausencia informada",
  "requests.reschedule_created": "Solicitacao de remarcacao",
  "requests.rejected": "Solicitacao rejeitada",
  "requests.approved": "Solicitacao aprovada",
  "import.ics_completed": "Importacao ICS concluida",
};

function severityClass(severity: string) {
  if (severity === "critical") return "bg-destructive text-white";
  if (severity === "warning") return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200";
}

function severityLabel(severity: string) {
  if (severity === "critical") return "Critico";
  if (severity === "warning") return "Atencao";
  return "Info";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function metadataEntries(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];

  return Object.entries(metadata as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
  }));
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function SystemLogsPanel() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const url = `/api/audit-logs?category=${encodeURIComponent(activeCategory)}&q=${encodeURIComponent(query)}&pageSize=100`;
  const { data, error, isLoading, mutate } = useSWR<AuditLogResponse>(url, fetcher, {
    refreshInterval: 30_000,
  });

  const logs = data?.logs ?? [];
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const category of data?.categories ?? []) map.set(category.id, category.count);
    return map;
  }, [data?.categories]);

  const totalCount = useMemo(
    () => Array.from(categoryCounts.values()).reduce((acc, count) => acc + count, 0),
    [categoryCounts]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-lg border bg-muted/20 p-2">
        <div className="px-2 py-2">
          <p className="text-sm font-semibold">Logs do sistema</p>
          <p className="text-xs text-muted-foreground">Eventos administrativos e de seguranca.</p>
        </div>

        <div className="mt-2 space-y-1">
          {CATEGORY_OPTIONS.map((category) => {
            const Icon = category.icon;
            const selected = activeCategory === category.id;
            const count = category.id === "all" ? totalCount : categoryCounts.get(category.id) ?? 0;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategory(category.id);
                  setExpandedLogId(null);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  selected ? "bg-primary text-primary-foreground" : "hover:bg-background"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{category.label}</span>
                  <span className={selected ? "text-xs text-primary-foreground/80" : "text-xs text-muted-foreground"}>
                    {count} evento{count === 1 ? "" : "s"}
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 transition ${selected ? "rotate-180" : ""}`} />
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 rounded-lg border bg-background">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Trilha de auditoria</h2>
            <p className="text-sm text-muted-foreground">Clique em um evento para abrir os detalhes.</p>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar..."
                className="w-full pl-9 md:w-64"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => mutate()}>
              Atualizar
            </Button>
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">Carregando logs...</div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error.message}
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
              Nenhum log encontrado para esta secao.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const expanded = expandedLogId === log.id;
                const metadata = metadataEntries(log.metadata);

                return (
                  <article key={log.id} className="overflow-hidden rounded-md border bg-card">
                    <button
                      type="button"
                      onClick={() => setExpandedLogId((current) => (current === log.id ? null : log.id))}
                      className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{actionLabel(log.action)}</span>
                          <Badge variant="outline" className={severityClass(log.severity)}>
                            {severityLabel(log.severity)}
                          </Badge>
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {log.actorName || log.actorEmail || "Sistema"} {log.targetLabel ? `-> ${log.targetLabel}` : ""}
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                        <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>

                    <div className={`grid transition-[grid-template-rows] duration-200 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <div className="grid gap-3 border-t bg-muted/20 p-4 text-sm md:grid-cols-2">
                          <Detail label="Acao" value={log.action} />
                          <Detail label="Categoria" value={log.category} />
                          <Detail label="Ator" value={log.actorName || log.actorEmail || "Sistema"} />
                          <Detail label="E-mail do ator" value={log.actorEmail || "-"} />
                          <Detail label="Alvo" value={log.targetLabel || log.targetId || "-"} />
                          <Detail label="Tipo do alvo" value={log.targetType || "-"} />
                          <Detail label="IP" value={log.ip || "-"} />
                          <Detail label="Navegador" value={log.userAgent || "-"} />

                          {metadata.length > 0 && (
                            <div className="md:col-span-2">
                              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Metadados</p>
                              <div className="grid gap-2 md:grid-cols-2">
                                {metadata.map((item) => (
                                  <Detail key={item.key} label={item.key} value={item.value} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}
