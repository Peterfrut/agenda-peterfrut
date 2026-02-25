"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { LogOut, Shield } from "lucide-react";
import { ToggleTheme } from "./ToggleTheme";
import { toast } from "sonner";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { set } from "date-fns";
import { Button } from "./ui/button";

const fetcher = (url: string) =>
  fetch(url).then((res) => (res.ok ? res.json() : null));

export function AvatarProfile() {
  const { data: me } = useSWR<{
    authenticated: boolean;
    user: { email: string; name: string | null; id: string | null; role?: string } | null;
  }>("/api/auth/me", fetcher);

  const router = useRouter();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function confirmLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setConfirmOpen(false);

    try {
      // 1)  remove o cookie
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        let msg = "Erro ao sair";
        try {
          const j = await res.json();
          msg = j?.error || j?.message || msg;
        } catch { }
        throw new Error(msg);
      }

      // 2) toast + espera 2s (sem derrubar o token ainda)
      await toast.promise(
        new Promise((resolve) => setTimeout(resolve, 700)),
        {
          loading: "Saindo...",
          success: "Logout efetuado com sucesso!",
          error: "Erro ao sair",
        }
      );

      // 3) e só então navega
      setTimeout(() => router.replace("/login"), 2000);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao sair");
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="w-12 h-12 cursor-pointer flex items-center justify-center">
        <AvatarFallback className="bg-gray-800 text-white font-bold text-2xl flex items-center justify-center">
          {me?.user?.name?.slice(0, 1).toLocaleUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col min-w-0">
        <span className="font-semibold truncate">{me?.user?.name ?? ""}</span>
        <span className="text-[13px] text-muted-foreground truncate">
          {(me?.user?.email ?? "").toLowerCase()}
        </span>
      </div>

      <div className="flex flex-col gap-1 items-center justify-center self-end">
        {me?.user?.role === "admin" ? (
          <Tooltip>
            <TooltipTrigger asChild>
                <Shield
                onClick={() => setTimeout(() => router.push("/import/import-ics"), 500)}
                className="text-muted-foreground hover:text-primary w-4"
                aria-label="Admin" />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Admin</p>
            </TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ToggleTheme />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Alterar tema</p>
          </TooltipContent>
        </Tooltip>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <button type="button" disabled={loggingOut}>
                  <LogOut
                    className={`w-4 cursor-pointer ${loggingOut
                      ? "opacity-40"
                      : "text-muted-foreground hover:text-primary"
                      }`}
                  />
                </button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{loggingOut ? "Saindo..." : "Sair"}</p>
            </TooltipContent>
          </Tooltip>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar logout</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja sair do sistema?
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={loggingOut}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmLogout();
                }}
                disabled={loggingOut}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loggingOut ? "Saindo..." : "Sair"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
