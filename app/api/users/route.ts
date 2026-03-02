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

    // Se o token já tem role. Se não, busca no banco.
    let role = roleFromToken;
    if (!role && userId) {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        role = u?.role ?? "";
    }

    if (role !== "admin") return { ok: false, status: 403, message: "Sem permissão" as const };
    return { ok: true as const };
}

export async function GET(req: NextRequest) {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize") || 20)));
    const pageNum = Math.max(1, Number(page ?? 1));
    const sizeNum = Math.max(1, Math.min(100, Number(pageSize ?? 20)));
    const skip = (pageNum - 1) * sizeNum;

    const where = q
        ? {
            OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
            ],
        }
        : {};

    const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                emailVerifiedAt: true,
            },
        }),
    ]);

    return NextResponse.json({
        ok: true,
        page: pageNum,
        pageSize: sizeNum,
        total,
        users,
    });
}