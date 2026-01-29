"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import logo from "@/public/logo_peterfrut.png";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";

async function readJsonSafe(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(text.slice(0, 200));
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const params = useParams();
  const token = useMemo(() => {
    const raw = (params as any)?.token;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [status, setStatus] = useState<"LOADING" | "OK" | "EXPIRED" | "INVALID">("LOADING");
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState<string | null>(null);
  const [resentErr, setResentErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await readJsonSafe(res);

        if (res.ok && data.ok) {
          setStatus("OK");
          setMsg("E-mail confirmado com sucesso. Você será direcionado ao login.");
          setTimeout(() => router.replace("/login"), 1200);
          return;
        }

        if (data?.code === "EXPIRED") {
          setStatus("EXPIRED");
          setMsg("Tempo limite de confirmação expirou. Solicite um novo link abaixo.");
          return;
        }

        setStatus("INVALID");
        setMsg("Link inválido. Solicite um novo link abaixo.");
      } catch (e: any) {
        setStatus("INVALID");
        setMsg(e.message || "Erro inesperado.");
      }
    })();
  }, [token, router]);

  async function resend() {
    setResentMsg(null);
    setResentErr(null);

    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) {
      setResentErr("Informe seu e-mail para reenviar o link.");
      return;
    }

    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNorm }),
      });

      const data = await readJsonSafe(res);
      if (!res.ok || !data.ok) throw new Error(data.message || "Erro ao reenviar.");

      setResentMsg("Se este e-mail existir e não estiver verificado, enviaremos um novo link.");
    } catch (e: any) {
      setResentErr(e.message || "Erro ao reenviar.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex w-full justify-center">
          <img src={logo.src} alt="Peterfrut" className="w-64" />
        </div>

        <h1 className="text-xl font-semibold text-center">Confirmação de e-mail</h1>

        {msg && (
          <Alert variant={status === "OK" ? "default" : "destructive"}>
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}

        {(status === "EXPIRED" || status === "INVALID") && (
          <div className="space-y-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="Digite seu e-mail para reenviar"
              disabled={resending}
            />

            {resentErr && (
              <Alert variant="destructive">
                <AlertDescription>{resentErr}</AlertDescription>
              </Alert>
            )}
            {resentMsg && (
              <Alert>
                <AlertDescription>{resentMsg}</AlertDescription>
              </Alert>
            )}

            <Button className="w-full" onClick={resend} disabled={resending}>
              {resending ? "Reenviando..." : "Reenviar link de confirmação"}
            </Button>
          </div>
        )}

        {status === "LOADING" && (
          <p className="text-sm text-muted-foreground text-center">Validando link...</p>
        )}
      </div>
    </div>
  );
}
