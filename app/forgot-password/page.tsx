"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import logo from "@/public/logo_peterfrut.png";

async function readJsonSafe(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(text.slice(0, 200));
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);

    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) {
      setError("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNorm }),
      });

      const data = await readJsonSafe(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Erro ao solicitar reset.");
      }

      setMsg("Se este e-mail existir no sistema, enviaremos um link de redefinição.");
    } catch (e: any) {
      setError(e.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="flex w-full justify-center">
          <img src={logo.src} alt="Peterfrut" className="w-64" />
        </div>

        <h1 className="text-xl font-semibold text-center">Esqueci minha senha</h1>

        <p className="text-sm text-muted-foreground text-center">
          Informe seu e-mail abaixo!
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}

        <Input
          type="email"
          value={email}
          placeholder="Digite aqui seu e-mail..."
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
          disabled={loading}
        />

        <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
          {loading ? "Enviando..." : "Enviar link"}
        </Button>
      </form>
    </div>
  );
}
