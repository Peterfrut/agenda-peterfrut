import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { isPeterfrutEmail, normEmail } from "@/lib/formatters";
import { createAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(75).optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(["user", "admin"]).optional(),
  active: z.boolean().optional(),
  verified: z.boolean().optional(),
  emailVerifiedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const { id } = await ctx.params;
  const parsed = updateUserSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message || "Dados invalidos" },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const data: {
    name?: string;
    email?: string;
    role?: "user" | "admin";
    active?: boolean;
    verified?: boolean;
    emailVerifiedAt?: Date | null;
  } = {};

  if (body.name) data.name = body.name;
  if (body.email) {
    const email = normEmail(body.email);
    if (!isPeterfrutEmail(email)) {
      return NextResponse.json(
        { ok: false, message: "Use um e-mail corporativo @peterfrut.com.br." },
        { status: 400 }
      );
    }
    data.email = email;
  }
  if (body.role) data.role = body.role;
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.verified === "boolean") {
    data.verified = body.verified;
    data.emailVerifiedAt = body.verified ? new Date() : null;
  } else if (body.emailVerifiedAt !== undefined) {
    data.emailVerifiedAt = body.emailVerifiedAt ? new Date(body.emailVerifiedAt) : null;
    data.verified = !!body.emailVerifiedAt;
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, active: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Usuario nao encontrado" }, { status: 404 });
  }

  if (id === auth.user.id && data.active === false) {
    return NextResponse.json(
      { ok: false, message: "Voce nao pode inativar o proprio usuario." },
      { status: 409 }
    );
  }

  const removesActiveAdmin =
    existing.role === "admin" &&
    existing.active &&
    (data.role === "user" || data.active === false);

  if (removesActiveAdmin) {
    const admins = await prisma.user.count({ where: { role: "admin", active: true } });
    if (admins <= 1) {
      return NextResponse.json(
        { ok: false, message: "Nao e possivel remover ou inativar o ultimo admin ativo." },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        verified: true,
        role: true,
        emailVerifiedAt: true,
      },
    });

    await createAuditLog(req, auth.user, {
      action: "users.updated",
      category: "users",
      severity: data.role || typeof data.active === "boolean" ? "warning" : "info",
      targetType: "user",
      targetId: updated.id,
      targetLabel: updated.email,
      metadata: {
        fields: Object.keys(data),
        active: updated.active,
        role: updated.role,
        verified: updated.verified,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      return NextResponse.json({ ok: false, message: "Este e-mail ja esta em uso." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, message: "Erro ao atualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const { id } = await ctx.params;

  if (id === auth.user.id) {
    return NextResponse.json(
      { ok: false, message: "Voce nao pode excluir o proprio usuario." },
      { status: 409 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Usuario nao encontrado" }, { status: 404 });
  }

  if (existing.role === "admin" && existing.active) {
    const admins = await prisma.user.count({ where: { role: "admin", active: true } });
    if (admins <= 1) {
      return NextResponse.json(
        { ok: false, message: "Nao e possivel excluir o ultimo admin ativo." },
        { status: 409 }
      );
    }
  }

  try {
    const deleted = await prisma.user.delete({ where: { id } });
    await createAuditLog(req, auth.user, {
      action: "users.deleted",
      category: "users",
      severity: "critical",
      targetType: "user",
      targetId: deleted.id,
      targetLabel: deleted.email,
      metadata: {
        role: deleted.role,
        active: deleted.active,
      },
    });
    return NextResponse.json({ ok: true, user: deleted });
  } catch {
    return NextResponse.json({ ok: false, message: "Erro ao deletar usuario" }, { status: 500 });
  }
}
