import prisma from "@/lib/prisma";
import { normEmail } from "@/lib/formatters";
import { sanitizeNotificationHref } from "@/lib/safe-links";
import type { Prisma } from "@prisma/client";

type NotificationInput = {
  type: string;
  title: string;
  message: string;
  href?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

const BLOCKED_METADATA_KEYS = new Set(["__proto__", "prototype", "constructor"]);

type SanitizedJsonValue = Prisma.InputJsonValue | null;

function sanitizeMetadataValue(value: unknown, depth = 0): SanitizedJsonValue | undefined {
  if (depth > 4) return undefined;

  if (value === null) return null;

  if (typeof value === "string") {
    return value.trim().slice(0, 1000);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const out: SanitizedJsonValue[] = [];

    for (const item of value.slice(0, 50)) {
      const clean = sanitizeMetadataValue(item, depth + 1);
      if (clean !== undefined) out.push(clean);
    }

    return out;
  }

  if (typeof value === "object") {
    const out: Record<string, SanitizedJsonValue> = {};

    for (const [key, raw] of Object.entries(value).slice(0, 50)) {
      const safeKey = key.trim().slice(0, 80);
      if (!safeKey || BLOCKED_METADATA_KEYS.has(safeKey)) continue;

      const clean = sanitizeMetadataValue(raw, depth + 1);
      if (clean !== undefined) out[safeKey] = clean;
    }

    return out as Prisma.InputJsonObject;
  }

  return undefined;
}

function sanitizeNotificationMetadata(value: unknown) {
  if (value === undefined || value === null) return undefined;

  const clean = sanitizeMetadataValue(value);
  if (clean === null || clean === undefined) return undefined;

  return clean;
}

export async function createNotification(userId: string, input: NotificationInput) {
  const metadata = sanitizeNotificationMetadata(input.metadata);

  return prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      href: sanitizeNotificationHref(input.href),
      ...(metadata === undefined ? {} : { metadata }),
    },
  });
}

export async function createNotificationForEmail(email: string, input: NotificationInput) {
  const user = await prisma.user.findUnique({
    where: { email: normEmail(email) },
    select: { id: true, active: true, emailVerifiedAt: true },
  });

  if (!user?.active || !user.emailVerifiedAt) return null;
  return createNotification(user.id, input);
}
