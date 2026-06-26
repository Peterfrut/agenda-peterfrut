import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { createAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);

  if (user) {
    await createAuditLog(req, user, {
      action: "auth.logout",
      category: "auth",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 0,
  });

  return res;
}
