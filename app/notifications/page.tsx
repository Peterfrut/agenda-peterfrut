"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import {
  AlertCircle,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  History,
  Info,
  Inbox,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  NotificationDetailsDialog,
  type NotificationDetailsItem,
} from "@/app/components/NotificationDetailsDialog";
import { notificationsSWRConfig, revalidateNotifications } from "@/app/components/notifications-cache";
import { isAllowedTeamsHref } from "@/lib/safe-links";

type NotificationItem = NotificationDetailsItem;

type NotificationsResponse = {
  ok: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  hasUnreadRelease: boolean;
};

type BookingRequest = {
  id: string;
  type: "reschedule" | "decline";
  status: "pending" | "approved" | "rejected" | string;
  requestedDate: string | null;
  requestedStartTime: string | null;
  requestedEndTime: string | null;
  description: string;
  requesterEmail: string;
  createdAt: string;
  booking: {
    title: string;
    roomName: string;
    date: string;
    startTime: string;
    endTime: string;
    userName: string;
  };
};

type RequestsResponse = {
  ok: boolean;
  sent: BookingRequest[];
  received: BookingRequest[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Erro ao carregar dados.");
  return json;
};

function formatStatus(status: string) {
  if (status === "pending") return "Pendente";
  if (status === "approved") return "Aceita";
  if (status === "rejected") return "Rejeitada";
  return status;
}

function statusBadgeClass(status: string) {
  if (status === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "pending") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "rejected") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-border bg-muted text-muted-foreground";
}

function readBadgeClass(readAt: string | null) {
  return readAt
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-destructive/30 bg-destructive/10 text-destructive";
}

function requestIcon(status: string) {
  if (status === "approved") return CheckCircle2;
  if (status === "rejected") return XCircle;
  return Clock3;
}

function notificationActionHref(href?: string | null) {
  return href && isAllowedTeamsHref(href) ? href : null;
}

function formatRequestTitle(request: BookingRequest) {
  if (request.type === "decline") return "Nao vai comparecer";
  return `Remarcar para ${request.requestedDate} ${request.requestedStartTime}-${request.requestedEndTime}`;
}

export default function NotificationsPage() {
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const { data: notificationsData, mutate: mutateNotifications } = useSWR<NotificationsResponse>(
    "/api/notifications",
    fetcher,
    notificationsSWRConfig
  );
  const { data: requestsData, mutate: mutateRequests } = useSWR<RequestsResponse>(
    "/api/booking-requests",
    fetcher,
    notificationsSWRConfig
  );

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true, markReleaseSeen: true }),
    });
    await mutateNotifications();
  }

  async function markOneRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await mutateNotifications();
  }

  async function resolveRequest(id: string, action: "approve" | "reject") {
    const promise = fetch("/api/booking-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    }).then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Erro ao responder solicitacao.");
      return json;
    });

    await toast.promise(promise, {
      loading: action === "approve" ? "Aprovando..." : "Rejeitando...",
      success: "Solicitacao atualizada.",
      error: (err) => (err instanceof Error ? err.message : "Erro ao responder solicitacao."),
    });

    await Promise.all([
      mutateRequests(),
      mutateNotifications(),
      revalidateNotifications(),
      globalMutate((key) => typeof key === "string" && key.startsWith("/api/bookings")),
    ]);
  }

  const pendingReceived = (requestsData?.received ?? []).filter((item) => item.status === "pending");
  const otherReceived = (requestsData?.received ?? []).filter((item) => item.status !== "pending");
  const notifications = notificationsData?.notifications ?? [];
  const sentRequests = requestsData?.sent ?? [];
  const unreadCount = notificationsData?.unreadCount ?? notifications.filter((item) => !item.readAt).length;
  const selectedNotification = notifications.find((item) => item.id === selectedNotificationId) ?? null;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Bell className="h-4 w-4" />
                Central de notificacoes
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Notificacoes</h1>
              <p className="text-sm text-muted-foreground">Avisos, convites e solicitacoes de agenda em um unico lugar.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={markAllRead}>
                <CheckCircle2 className="h-4 w-4" />
                Marcar lidas
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Agenda</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={AlertCircle}
            label="Nao lidas"
            value={unreadCount}
            badge="Atenção"
            badgeClass="border-destructive/30 bg-destructive/10 text-destructive"
          />
          <SummaryCard
            icon={Clock3}
            label="Pendentes"
            value={pendingReceived.length}
            badge="Aguardando"
            badgeClass="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          />
          <SummaryCard
            icon={Send}
            label="Enviadas"
            value={sentRequests.length}
            badge="Minhas"
            badgeClass="border-primary/30 bg-primary/10 text-primary"
          />
          <SummaryCard
            icon={History}
            label="Historico"
            value={otherReceived.length}
            badge="Resolvidas"
            badgeClass="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          />
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Sugestoes recebidas</h2>
              </div>
              <p className="text-sm text-muted-foreground">Solicitacoes que precisam da sua resposta.</p>
          </div>
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              {pendingReceived.length} pendente{pendingReceived.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="space-y-3 p-4">
            {pendingReceived.length ? (
              pendingReceived.map((request) => (
                <div key={request.id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        <Clock3 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{formatRequestTitle(request)}</p>
                          <Badge variant="outline" className={statusBadgeClass(request.status)}>
                            {formatStatus(request.status)}
                          </Badge>
                        </div>
                      <p className="text-sm text-muted-foreground">
                        {request.requesterEmail} em &quot;{request.booking.title}&quot; - {request.booking.roomName}
                      </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reserva original: {new Date(`${request.booking.date}T00:00:00`).toLocaleDateString("pt-BR")} das {request.booking.startTime} as {request.booking.endTime}
                        </p>
                      <p className="mt-2 text-sm">{request.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => resolveRequest(request.id, "approve")}>
                        <Check className="h-4 w-4" />
                        Aceitar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => resolveRequest(request.id, "reject")}
                      >
                        <X className="h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma sugestao de remarcacao pendente.</p>
            )}
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Notificacoes</h2>
              </div>
              <Badge variant="outline" className={unreadCount ? readBadgeClass(null) : readBadgeClass(new Date().toISOString())}>
                {unreadCount ? `${unreadCount} nao lida${unreadCount === 1 ? "" : "s"}` : "Todas lidas"}
              </Badge>
            </div>
            <div className="space-y-2 p-4">
              {notifications.length ? (
                notifications.map((item) => {
                  const actionHref = notificationActionHref(item.href);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-md border p-3 text-sm ${
                        item.readAt
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${item.readAt ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
                          {item.readAt ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">{item.title}</p>
                            <Badge variant="outline" className={readBadgeClass(item.readAt)}>
                              {item.readAt ? "Lida" : "Nao lida"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">{item.message}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString("pt-BR")}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {actionHref && (
                              <Button type="button" size="sm" variant="outline" asChild>
                                <a
                                  href={actionHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => {
                                    if (!item.readAt) void markOneRead(item.id);
                                  }}
                                >
                                  Abrir Teams
                                </a>
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedNotificationId(item.id)}
                            >
                              <Info className="h-4 w-4" />
                              Ver detalhes
                            </Button>
                            {!item.readAt && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => markOneRead(item.id)}
                              >
                                Marcar como lida
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma notificacao.</p>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Minhas solicitacoes e avisos</h2>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {sentRequests.length} enviada{sentRequests.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="space-y-2 p-4">
              {sentRequests.length ? (
                sentRequests.map((request) => {
                  const Icon = requestIcon(request.status);

                  return (
                    <div key={request.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${statusBadgeClass(request.status)}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">{formatRequestTitle(request)}</p>
                            <Badge variant="outline" className={statusBadgeClass(request.status)}>
                              {formatStatus(request.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            &quot;{request.booking.title}&quot; - {request.booking.roomName}
                          </p>
                          <p className="mt-2">{request.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Voce ainda nao enviou solicitacoes.</p>
              )}
            </div>
          </Card>
        </div>

        {otherReceived.length > 0 && (
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/30 p-4">
              <History className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Historico recebido</h2>
            </div>
            <div className="space-y-2 p-4">
              {otherReceived.map((request) => {
                const Icon = requestIcon(request.status);

                return (
                  <div key={request.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${statusBadgeClass(request.status)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold">{formatRequestTitle(request)}</p>
                          <Badge variant="outline" className={statusBadgeClass(request.status)}>
                            {formatStatus(request.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {request.requesterEmail} em &quot;{request.booking.title}&quot;
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <NotificationDetailsDialog
          notification={selectedNotification}
          onClose={() => setSelectedNotificationId(null)}
          onMarkRead={markOneRead}
        />
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  badge,
  badgeClass,
}: {
  icon: typeof Bell;
  label: string;
  value: number;
  badge: string;
  badgeClass: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <Badge variant="outline" className={badgeClass}>
          {badge}
        </Badge>
      </div>
      <p className="mt-4 text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}
