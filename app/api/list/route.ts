import { NextResponse } from "next/server";
import { ROOMS } from "@/lib/rooms";

export async function GET() {
  return NextResponse.json(ROOMS);
}
