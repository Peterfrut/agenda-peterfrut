"use client";

import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

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

function formatRequestTitle(request: BookingRequest) {
  if (request.type === "decline") return "Nao vai comparecer";
  return `Remarcar para ${request.requestedDate} ${request.requestedStartTime}-${request.requestedEndTime}`;
}

export default function NotificationsPage() {
  const { data: notificationsData, mutate: mutateNotifications } = useSWR<NotificationsResponse>(
    "/api/notifications",
    fetcher
  );
  const { data: requestsData, mutate: mutateRequests } = useSWR<RequestsResponse>(
    "/api/booking-requests",
    fetcher
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
      globalMutate((key) => typeof key === "string" && key.startsWith("/api/bookings")),
    ]);
  }

  const pendingReceived = (requestsData?.received ?? []).filter((item) => item.status === "pending");
  const otherReceived = (requestsData?.received ?? []).filter((item) => item.status !== "pending");

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notificacoes</h1>
            <p className="text-sm text-muted-foreground">Avisos, convites e solicitacoes de agenda.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={markAllRead}>
              Marcar lidas
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Agenda</Link>
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold">Sugestoes recebidas</h2>
          <div className="space-y-3">
            {pendingReceived.length ? (
              pendingReceived.map((request) => (
                <div key={request.id} className="rounded-md border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{formatRequestTitle(request)}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.requesterEmail} em &quot;{request.booking.title}&quot; - {request.booking.roomName}
                      </p>
                      <p className="mt-2 text-sm">{request.description}</p>
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
          <Card className="p-4">
            <h2 className="mb-3 text-lg font-semibold">Notificacoes</h2>
            <div className="space-y-2">
              {(notificationsData?.notifications ?? []).length ? (
                notificationsData!.notifications.map((item) => (
                  <div key={item.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{item.title}</p>
                      {!item.readAt ? (
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      ) : (
                        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Lida</span>
                      )}
                    </div>
                    <p className="mt-1 text-muted-foreground">{item.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </p>
                    {!item.readAt && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => markOneRead(item.id)}
                      >
                        Marcar como lida
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma notificacao.</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-lg font-semibold">Minhas solicitacoes e avisos</h2>
            <div className="space-y-2">
              {(requestsData?.sent ?? []).length ? (
                requestsData!.sent.map((request) => (
                  <div key={request.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{formatRequestTitle(request)}</p>
                      <span className="rounded-md bg-muted px-2 py-1 text-xs">{formatStatus(request.status)}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      &quot;{request.booking.title}&quot; - {request.booking.roomName}
                    </p>
                    <p className="mt-2">{request.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Voce ainda nao enviou solicitacoes.</p>
              )}
            </div>
          </Card>
        </div>

        {otherReceived.length > 0 && (
          <Card className="p-4">
            <h2 className="mb-3 text-lg font-semibold">Historico recebido</h2>
            <div className="space-y-2">
              {otherReceived.map((request) => (
                <div key={request.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{formatRequestTitle(request)}</p>
                    <span className="rounded-md bg-muted px-2 py-1 text-xs">{formatStatus(request.status)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {request.requesterEmail} em &quot;{request.booking.title}&quot;
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
