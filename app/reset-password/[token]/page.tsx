"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import logo from "@/public/logo_peterfrut.png";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/app/components/ui/label";

async function readJsonSafe(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(text.slice(0, 200));
}

type ValidateResp =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "error" };

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();

  const rawToken = (params as any)?.token;
  const token = useMemo(
    () => (Array.isArray(rawToken) ? rawToken[0] : rawToken),
    [rawToken]
  );

  const [checking, setChecking] = useState(true);
  const [tokenStatus, setTokenStatus] = useState<
    "ok" | "expired" | "invalid" | "error"
  >("ok");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // valida token antes de renderizar o formulário
  useEffect(() => {
    let alive = true;

    async function validate() {
      if (!token) {
        if (!alive) return;
        setTokenStatus("invalid");
        setChecking(false);
        return;
      }

      setChecking(true);
      try {
        const res = await fetch(`/api/auth/reset/validate?token=${encodeURIComponent(token)}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = (await readJsonSafe(res)) as ValidateResp;

        if (!alive) return;

        if (data.ok) setTokenStatus("ok");
        else {
          if (data.reason === "expired") setTokenStatus("expired");
          else if (data.reason === "invalid") setTokenStatus("invalid");
          else setTokenStatus("error");
        }
      } catch {
        if (!alive) return;
        setTokenStatus("error");
      } finally {
        if (!alive) return;
        setChecking(false);
      }
    }

    validate();
    return () => {
      alive = false;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!token) {
      setErr("Token inválido.");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setErr("Informe uma senha com pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErr("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await readJsonSafe(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Erro ao redefinir senha.");
      }

      setMsg("Senha redefinida com sucesso. Você será direcionado para o login.");
      setTimeout(() => router.push("/login"), 1200);
    } catch (e: any) {
      setErr(e.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  // estados do token
  const expiredView =
    tokenStatus === "expired" && !checking ? (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Tempo limite do link expirou. Solicite um novo link de redefinição.
          </AlertDescription>
        </Alert>

        <Button
          type="button"
          className="w-full"
          onClick={() => router.push("/forgot-password")}
        >
          Solicitar outro link
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Voltar para o login
        </Button>
      </div>
    ) : null;

  const invalidView =
    tokenStatus === "invalid" && !checking ? (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Link inválido. Solicite um novo link de redefinição.
          </AlertDescription>
        </Alert>

        <Button
          type="button"
          className="w-full"
          onClick={() => router.push("/forgot-password")}
        >
          Solicitar outro link
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Voltar para o login
        </Button>
      </div>
    ) : null;

  const errorView =
    tokenStatus === "error" && !checking ? (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Não foi possível validar o link agora. Tente novamente.
          </AlertDescription>
        </Alert>

        <Button
          type="button"
          className="w-full"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </Button>
      </div>
    ) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm"
      >
        <div className="flex w-full justify-center">
          <img src={logo.src} alt="Peterfrut" className="w-64" />
        </div>

        <h1 className="text-xl font-semibold text-center">Redefinir senha</h1>

        {checking && (
          <p className="text-sm text-muted-foreground text-center">
            Validando link...
          </p>
        )}

        {expiredView}
        {invalidView}
        {errorView}

        {/* mostra formulário se token for OK */}
        {tokenStatus === "ok" && !checking && (
          <>
            {err && (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            {msg && (
              <Alert>
                <AlertDescription>{msg}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="password">Nova senha</Label>

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  placeholder="Escolha uma senha..."
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                  disabled={loading}
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
                      aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                      disabled={loading}
                    >
                      {showPassword ? (
                        <Eye className="h-4 w-4 cursor-pointer" />
                      ) : (
                        <EyeOff className="h-4 w-4 cursor-pointer" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showPassword ? "Ocultar" : "Exibir"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirmar senha</Label>

              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  placeholder="Confirme sua senha..."
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                  disabled={loading}
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
                      aria-label={showConfirm ? "Ocultar confirmação" : "Exibir confirmação"}
                      disabled={loading}
                    >
                      {showConfirm ? (
                        <Eye className="h-4 w-4 cursor-pointer" />
                      ) : (
                        <EyeOff className="h-4 w-4 cursor-pointer" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showConfirm ? "Ocultar" : "Exibir"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Redefinir senha"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
