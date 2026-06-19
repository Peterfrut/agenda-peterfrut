"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, CheckCheck, HelpCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  ok: boolean;
  unreadCount: number;
  hasUnreadRelease: boolean;
  latestRelease?: {
    version: string;
    title: string;
  };
  notifications: NotificationItem[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Erro ao buscar notificacoes.");
  return json;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data } = useSWR<NotificationsResponse>("/api/notifications", fetcher);

  const badgeCount = (data?.unreadCount ?? 0) + (data?.hasUnreadRelease ? 1 : 0);
  const latest = data?.latestRelease;

  useEffect(() => {
    if (!data?.hasUnreadRelease || !latest) return;
    const key = `release-toast:${latest.version}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    toast.info(`Nova atualizacao ${latest.version} disponivel.`, {
      description: latest.title,
      action: {
        label: "Ver",
        onClick: () => router.push("/patch-notes"),
      },
    });
  }, [data?.hasUnreadRelease, latest, router]);

  async function patchNotifications(body: Record<string, unknown>) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await globalMutate((key) => typeof key === "string" && key.startsWith("/api/notifications"));
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8"
                >
                  <Bell className="h-4 w-4" />
                  {badgeCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Notificacoes</p>
            </TooltipContent>
          </Tooltip>

          <PopoverContent align="end" side="bottom" sideOffset={8} className="w-[min(380px,calc(100vw-24px))] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-semibold">Notificacoes</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patchNotifications({ markAllRead: true, markReleaseSeen: true })}
              >
                <CheckCheck className="h-4 w-4" />
                Lidas
              </Button>
            </div>

            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {data?.hasUnreadRelease && latest && (
                <div className="rounded-md border bg-muted/50 p-3">
                  <p className="text-sm font-semibold">Nova atualizacao {latest.version}</p>
                  <p className="text-sm text-muted-foreground">{latest.title}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        await patchNotifications({ markReleaseSeen: true });
                        setOpen(false);
                        router.push("/patch-notes");
                      }}
                    >
                      Ver
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => patchNotifications({ markReleaseSeen: true })}
                    >
                      Dispensar
                    </Button>
                  </div>
                </div>
              )}

              {(data?.notifications ?? []).slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{item.title}</span>
                    {!item.readAt ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    ) : (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Lida</span>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">{item.message}</p>
                  {!item.readAt && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 px-2"
                      onClick={() => patchNotifications({ id: item.id })}
                    >
                      Marcar como lida
                    </Button>
                  )}
                </div>
              ))}

              {!data?.hasUnreadRelease && !(data?.notifications ?? []).length && (
                <p className="text-sm text-muted-foreground">Nenhuma notificacao por enquanto.</p>
              )}
            </div>

            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
            >
              Ver detalhes
            </Button>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push("/patch-notes")}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Ajuda e atualizacoes</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
