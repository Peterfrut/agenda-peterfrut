import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/security";
import { normEmail } from "@/lib/formatters";
import type { SessionUser } from "@/lib/api-auth";

type AuditSeverity = "info" | "warning" | "critical";

type AuditActor =
  | SessionUser
  | {
      id?: string | null;
      name?: string | null;
      email?: string | null;
    }
  | null;

type AuditLogInput = {
  action: string;
  category: string;
  severity?: AuditSeverity;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: unknown;
};

const BLOCKED_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "password",
  "senha",
  "token",
  "authorization",
  "cookie",
  "secret",
  "apiKey",
  "api_key",
  "resetUrl",
  "verifyUrl",
]);

function sanitizeMetadataValue(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (depth > 4) return undefined;
  if (value === null) return undefined;

  if (typeof value === "string") return value.trim().slice(0, 500);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    const out: Prisma.InputJsonValue[] = [];
    for (const item of value.slice(0, 30)) {
      const clean = sanitizeMetadataValue(item, depth + 1);
      if (clean !== undefined) out.push(clean);
    }
    return out;
  }

  if (typeof value === "object") {
    const out: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, raw] of Object.entries(value).slice(0, 40)) {
      const safeKey = key.trim().slice(0, 80);
      if (!safeKey || BLOCKED_KEYS.has(safeKey)) continue;

      const clean = sanitizeMetadataValue(raw, depth + 1);
      if (clean !== undefined) out[safeKey] = clean;
    }
    return out;
  }

  return undefined;
}

function sanitizeMetadata(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const clean = sanitizeMetadataValue(value);
  return clean === undefined || clean === null ? undefined : clean;
}

function actorData(actor: AuditActor) {
  if (!actor) return {};

  return {
    actorId: actor.id || null,
    actorName: actor.name ? String(actor.name).slice(0, 120) : null,
    actorEmail: actor.email ? normEmail(actor.email) : null,
  };
}

export async function createAuditLog(req: NextRequest, actor: AuditActor, input: AuditLogInput) {
  try {
    const metadata = sanitizeMetadata(input.metadata);
    const userAgent = req.headers.get("user-agent")?.slice(0, 300) || null;

    await prisma.auditLog.create({
      data: {
        action: input.action.slice(0, 120),
        category: input.category.slice(0, 80),
        severity: input.severity ?? "info",
        ...actorData(actor),
        targetType: input.targetType?.slice(0, 80) || null,
        targetId: input.targetId?.slice(0, 120) || null,
        targetLabel: input.targetLabel?.slice(0, 200) || null,
        ip: getClientIp(req).slice(0, 120),
        userAgent,
        ...(metadata === undefined ? {} : { metadata }),
      },
    });
  } catch (err) {
    console.error("[AUDIT LOG] Falha ao registrar evento.", err);
  }
}
