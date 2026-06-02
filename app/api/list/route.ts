import { NextRequest, NextResponse } from "next/server";
import { ROOMS } from "@/lib/rooms";
import { requireUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  return NextResponse.json(ROOMS);
}
