"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { LogOut, Shield } from "lucide-react";
import { ToggleTheme } from "./ToggleTheme";
import { toast } from "sonner";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
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

type MeResponse = {
  authenticated: boolean;
  user: { email: string; name: string | null; id: string | null; role?: string } | null;
};

export function AvatarProfile() {
  const { data: me, isLoading } = useSWR<MeResponse>("/api/auth/me");
  const router = useRouter();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function confirmLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setConfirmOpen(false);

    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!res.ok) {
        let msg = "Erro ao sair";
        try {
          const j = await res.json();
          msg = j?.error || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      await toast.promise(new Promise((resolve) => setTimeout(resolve, 700)), {
        loading: "Saindo...",
        success: "Logout efetuado com sucesso!",
        error: "Erro ao sair",
      });

      setTimeout(() => router.replace("/login"), 2000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao sair");
    } finally {
      setLoggingOut(false);
    }
  }

  const displayName = isLoading ? "Carregando..." : (me?.user?.name ?? "");
  const displayEmail = isLoading ? "" : (me?.user?.email ?? "").toLowerCase();
  const initial = me?.user?.name?.slice(0, 1).toLocaleUpperCase() ?? "?";

  return (
    <div className="flex items-center lg:gap-2 w-full">
      <div className="w-full flex gap-1 lg:gap-2 items-center">
        <Avatar className="w-10 h-10 lg:w-12 lg:h-12 cursor-pointer flex items-center justify-center">
          <AvatarFallback className="bg-secondary-foreground text-muted font-bold text-xs md:text-2xl flex items-center justify-center">
            {initial}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col min-w-0">
          <span className="text-[14px] lg:text-base font-semibold truncate">
            {displayName}
          </span>
          <span className="text-xs lg:text-[13px] text-muted-foreground truncate">
            {displayEmail}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center self-end">
        {me?.user?.role === "admin" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Shield
                className="w-4 text-muted-foreground hover:text-primary"
                aria-label="Admin"
                onClick={() => setTimeout(() => router.push("/painel"), 500)}
              />
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
                    className={`w-4 cursor-pointer ${
                      loggingOut ? "opacity-40" : "text-muted-foreground hover:text-primary"
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
              <AlertDialogDescription>Tem certeza que deseja sair do sistema?</AlertDialogDescription>
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
