import { NextRequest, NextResponse } from "next/server";

export function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  return (forwardedFor?.split(",")[0] || realIp || "ip:unknown").trim();
}

export function jsonError(message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, message, error: message }, { status, headers });
}

export function retryAfterResponse(message: string, resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { ok: false, message: `${message} Tente novamente em ${retryAfter}s.`, error: `${message} Tente novamente em ${retryAfter}s.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getAppBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  const url = new URL(withProtocol);
  return url.toString().replace(/\/$/, "");
}
