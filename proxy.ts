// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, getTokenFromRequest } from "@/lib/auth";

// rotas e prefixos públicos (liberados sem login)
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
  "/sala_reuniao_sup.png"
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      let originUrl: URL | null = null;
      try {
        originUrl = new URL(origin);
      } catch {
        return NextResponse.json({ ok: false, message: "Origem inválida" }, { status: 403 });
      }
      if (originUrl.host !== req.nextUrl.host) {
        return NextResponse.json({ ok: false, message: "Origem inválida" }, { status: 403 });
      }
    }
  }

  // libera rotas públicas (igualdade ou prefixo)
  if (
    PUBLIC_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    )
  ) {
    return NextResponse.next();
  }

  const token = getTokenFromRequest(req);
  const payload = token ? await verifyJwt(token) : null;

  // não autenticado → manda pro login
  if (!payload) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// aplica em tudo, exceto estáticos
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
