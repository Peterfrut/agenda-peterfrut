"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import logo from "@/public/logo_peterfrut.png";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { 
        method: "POST", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ email, password }), 
      });
      const json = await res.json(); if (!res.ok || !json.ok) throw new Error(json.message || "Login inválido");

      toast.promise(new Promise((resolve) => setTimeout(resolve, 700)),
        { loading: "Verificando credenciais...", success: "Login efetuado com sucesso!", error: "Erro ao entrar!", });
      setTimeout(() => router.replace("/"), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50  ">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm"
      >
        <div className="w-full flex justify-center items-center">
          <img src={logo.src} alt="" className="w-64" />
        </div>
        <h1 className="text-xl font-semibold text-center">
          Fazer Login
        </h1>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase())}
            placeholder="Digite aqui seu email..."
          />
        </div>

        <div className="grid gap-2 relative">

          <Label htmlFor="password">Senha</Label>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="Escolha uma senha..."
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-10"

            />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
                  aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
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

        <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>

        {/*"Cadastrar" e "Esqueci a senha" */}
        <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
          <button
            type="button"
            className="self-start text-xs text-primary hover:underline cursor-pointer"
            onClick={() => setTimeout(() => router.push("/forgot-password"), 1000)}
          >
            Esqueceu sua senha?
          </button>

          <div className="text-xs">
            Não tem conta?
            <button
              type="button"
              className="ml-1 text-primary hover:underline cursor-pointer"
              onClick={() => setTimeout(() => router.push("/register"), 1000)}
            >
              Cadastrar-se
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
