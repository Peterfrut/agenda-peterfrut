import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, getTokenFromRequest } from "@/lib/auth";

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
  "/api/auth/reset",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/_next",
  "/favicon.ico",
  "/logo_peterfrut.png",
  "/auditorio_sup.png",
  "/sala_reuniao_sup.png",
];

const CRON_PREFIXES = ["/api/jobs/reminders", "/api/jobs/remidenrs"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const SECURITY_HEADERS: Array<[string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Frame-Options", "DENY"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ["Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'none'"],
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function withSecurityHeaders(response: NextResponse) {
  for (const [key, value] of SECURITY_HEADERS) {
    response.headers.set(key, value);
  }
  return response;
}

function forbidden(message: string) {
  return withSecurityHeaders(NextResponse.json({ ok: false, message }, { status: 403 }));
}

function isSameHost(value: string, req: NextRequest) {
  try {
    return new URL(value).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

function validateUnsafeRequest(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return null;

  const origin = req.headers.get("origin");
  if (origin) {
    return isSameHost(origin, req) ? null : "Origem invalida";
  }

  const referer = req.headers.get("referer");
  if (referer) {
    return isSameHost(referer, req) ? null : "Origem invalida";
  }

  return "Origem ausente";
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isCronRoute = matchesPrefix(pathname, CRON_PREFIXES);

  const unsafeError = isCronRoute ? null : validateUnsafeRequest(req);
  if (unsafeError) {
    return forbidden(unsafeError);
  }

  if (matchesPrefix(pathname, PUBLIC_PREFIXES) || isCronRoute) {
    return withSecurityHeaders(NextResponse.next());
  }

  const token = getTokenFromRequest(req);
  const payload = token ? await verifyJwt(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", req.url);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
