"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import logo from "@/public/logo_peterfrut.png";
import { Eye, EyeOff } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(5);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const timerRef = useRef<number | null>(null);

  const nextParam = searchParams.get("next") || "";

  const loginUrl = useMemo(() => {
    const next = nextParam ? encodeURIComponent(nextParam) : "";
    return next ? `/login?next=${next}` : "/login";
  }, [nextParam]);

  useEffect(() => {
    const emailParam = (searchParams.get("email") || "").toLowerCase().trim();
    if (emailParam && !email) setEmail(emailParam);
  }, [searchParams]);

  // Contador + redirect após sucesso
  useEffect(() => {
    if (!success) return;

    setSecondsLeft(5);

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          router.replace(loginUrl); // replace para não voltar ao register
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [success, loginUrl, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || success) return;

    setError(null);

    if (!name.trim()) {
      setError("Informe seu nome.");
      return;
    }

    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }

    if (!password) {
      setError("Informe sua senha.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas não conferem");
      return;
    }

    if (!password.trim() || password.length < 6) {
      setError("Informe uma senha com pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Erro ao cadastrar");
      }

      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex w-full justify-center mb-4">
          <img src={logo.src} alt="Peterfrut" className="w-64" />
        </div>

        <h1 className="text-xl font-semibold text-center mb-4">
          {success ? "Cadastro realizado" : "Criar Cadastro"}
        </h1>

        {error && !success && (
          <p className="text-sm text-red-500 text-center mb-3">{error}</p>
        )}

        {/* APÓS SUCESSO: MOSTRA SOMENTE A MENSAGEM */}
        {success ? (
          <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-sm text-green-700">
              Conta registrada. Em instantes você receberá um e-mail para confirmar o cadastro.
              <br />
              Em <strong>{secondsLeft}</strong> segundo{secondsLeft === 1 ? "" : "s"} você será
              redirecionado para a página de login.
            </p>

            <Button type="button" className="w-full cursor-pointer" onClick={() => router.replace(loginUrl)}>
              Ir para o login agora
            </Button>
          </div>
        ) : (
          /* FORMULÁRIO NORMAL */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                value={name}
                placeholder="Digite aqui seu nome completo..."
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                placeholder="Digite aqui seu email corporativo..."
                onChange={(e) => setEmail(e.target.value.toLocaleLowerCase())}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {/* SENHA */}
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
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
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showPassword ? "Ocultar" : "Exibir"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* CONFIRMAR SENHA */}
            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  placeholder="Confirme sua senha escolhida..."
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
                      {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showConfirm ? "Ocultar" : "Exibir"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
              {loading ? "Salvando..." : "Cadastrar"}
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              Já possui conta?
              <button
                type="button"
                className="ml-1 text-primary hover:underline cursor-pointer"
                onClick={() => router.push(loginUrl)}
              >
                Entrar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  // em páginas que podem ser pré-renderizadas. Mantemos a página como Client Component,
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
            <div className="h-6 w-40 bg-muted rounded" />
            <div className="mt-4 space-y-3">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </div>
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
