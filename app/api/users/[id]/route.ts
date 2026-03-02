import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTokenFromRequest, verifyJwt } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return { ok: false, status: 401, message: "Não autenticado" as const };

  const payload: any = await verifyJwt(token);
  if (!payload) return { ok: false, status: 401, message: "Token inválido" as const };

  const userId = String(payload?.sub ?? "").trim();
  const roleFromToken = String(payload?.role ?? "").trim();

  let role = roleFromToken;
  if (!role && userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    role = u?.role ?? "";
  }

  if (role !== "admin") return { ok: false, status: 403, message: "Sem permissão" as const };
  return { ok: true as const };
}

type Body = {
  name?: string;
  email?: string;
  role?: string;
  emailVerifiedAt?: Date | null;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const data: any = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.email === "string") data.email = body.email.trim().toLowerCase();
  if (typeof body.role === "string") data.role = body.role.trim();
  if (typeof body.emailVerifiedAt === "string") data.emailVerifiedAt = new Date(body.emailVerifiedAt);
  

  // Validações mínimas
  if (data.email && !data.email.includes("@")) {
    return NextResponse.json({ ok: false, message: "E-mail inválido" }, { status: 400 });
  }
  if (data.role && !["user", "admin"].includes(data.role)) {
    return NextResponse.json({ ok: false, message: "Permissão inválida" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, verified: true, role: true },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ ok: false, message: "Este e-mail já está em uso." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, message: "Erro ao atualizar usuário" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const { id } = await ctx.params;

  const data: any = {};

  // Validações mínimas
  if (data.email && !data.email.includes("@")) {
    return NextResponse.json({ ok: false, message: "E-mail inválido" }, { status: 400 });
  }
  if (data.role && !["user", "admin"].includes(data.role)) {
    return NextResponse.json({ ok: false, message: "Permissão inválida" }, { status: 400 });
  }

  try {
    const deleted = await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, user: deleted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: "Erro ao deletar usuário" }, { status: 500 });
  }
}