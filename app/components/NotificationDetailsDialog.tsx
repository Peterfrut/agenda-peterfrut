"use client";

import { CheckCircle2, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { isAllowedTeamsHref } from "@/lib/safe-links";

export type NotificationDetailsItem = {
  id: string;
  type?: string;
  title: string;
  message: string;
  href?: string | null;
  metadata?: unknown | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationDetail = {
  label: string;
  value: string;
};

type NotificationMetadata = {
  description?: string;
  details: NotificationDetail[];
  participants: string[];
};

function readBadgeClass(readAt: string | null) {
  return readAt
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-destructive/30 bg-destructive/10 text-destructive";
}

function notificationActionHref(href?: string | null) {
  return href && isAllowedTeamsHref(href) ? href : null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNotificationMetadata(value: unknown): NotificationMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { details: [], participants: [] };
  }

  const record = value as Record<string, unknown>;
  const participants = Array.isArray(record.participants)
    ? record.participants
        .map((item) => readText(item))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const details = Array.isArray(record.details)
    ? record.details
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const entry = item as Record<string, unknown>;
          const label = readText(entry.label);
          const entryValue = readText(entry.value);
          return label && entryValue ? { label, value: entryValue } : null;
        })
        .filter((item): item is NotificationDetail => Boolean(item))
        .filter((item) => {
          if (!participants.length) return true;
          return !["convidados", "participantes"].includes(item.label.trim().toLowerCase());
        })
    : [];

  return {
    description: readText(record.description) || undefined,
    details,
    participants,
  };
}

export function NotificationDetailsDialog({
  notification,
  onClose,
  onMarkRead,
}: {
  notification: NotificationDetailsItem | null;
  onClose: () => void;
  onMarkRead: (id: string) => Promise<void> | void;
}) {
  if (!notification) return null;

  const metadata = normalizeNotificationMetadata(notification.metadata);
  const actionHref = notificationActionHref(notification.href);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="outline" className={readBadgeClass(notification.readAt)}>
              {notification.readAt ? "Lida" : "Nao lida"}
            </Badge>
          </div>
          <DialogTitle className="leading-snug">{notification.title}</DialogTitle>
          <DialogDescription>{metadata.description || notification.message}</DialogDescription>
          <p className="text-xs text-muted-foreground">
            Recebida em {new Date(notification.createdAt).toLocaleString("pt-BR")}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {metadata.details.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {metadata.details.map((detail) => (
                <div key={`${detail.label}-${detail.value}`} className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{detail.label}</p>
                  <p className="mt-1 break-words text-sm font-medium">{detail.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Informacoes disponiveis</p>
              <p className="mt-1 text-sm font-medium">{notification.message}</p>
            </div>
          )}

          {metadata.participants.length > 0 && (
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" />
                Convidados
              </div>
              <div className="flex flex-wrap gap-2">
                {metadata.participants.map((participant) => (
                  <Badge key={participant} variant="outline" className="max-w-full break-all">
                    {participant}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!notification.readAt && (
            <Button type="button" variant="outline" onClick={() => onMarkRead(notification.id)}>
              <CheckCircle2 className="h-4 w-4" />
              Marcar como lida
            </Button>
          )}
          {actionHref && (
            <Button type="button" asChild>
              <a href={actionHref} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Abrir Teams
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
