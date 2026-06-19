import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { LATEST_RELEASE_NOTE } from "@/lib/release-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
  markReleaseSeen: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId: auth.user.id, readAt: null },
    }),
  ]);

  const latestPublishedAt = new Date(LATEST_RELEASE_NOTE.publishedAt);
  const hasUnreadRelease =
    !auth.user.lastSeenReleaseAt || auth.user.lastSeenReleaseAt < latestPublishedAt;

  return NextResponse.json({
    ok: true,
    notifications,
    unreadCount,
    latestRelease: LATEST_RELEASE_NOTE,
    hasUnreadRelease,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Dados invalidos." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const now = new Date();

  if (data.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: auth.user.id, readAt: null },
      data: { readAt: now },
    });
  } else if (data.id) {
    await prisma.notification.updateMany({
      where: { id: data.id, userId: auth.user.id, readAt: null },
      data: { readAt: now },
    });
  }

  if (data.markReleaseSeen) {
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { lastSeenReleaseAt: new Date(LATEST_RELEASE_NOTE.publishedAt) },
    });
  }

  return NextResponse.json({ ok: true });
}
