import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
      lastSeenReleaseAt: user.lastSeenReleaseAt,
    },
  });
}
