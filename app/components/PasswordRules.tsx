"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { getPasswordRules } from "@/lib/formatters";

type PasswordRulesProps = {
  password: string;
  confirm?: string;
};

export function PasswordRules({ password, confirm }: PasswordRulesProps) {
  const rules = getPasswordRules(password);
  const showConfirm = confirm !== undefined;
  const confirmOk = showConfirm && password.length > 0 && password === confirm;

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
      <div className="grid gap-1.5">
        {rules.map((rule) => (
          <div
            key={rule.key}
            className={rule.valid ? "flex items-center gap-2 text-emerald-700" : "flex items-center gap-2"}
          >
            {rule.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            <span>{rule.label}</span>
          </div>
        ))}

        {showConfirm && (
          <div className={confirmOk ? "flex items-center gap-2 text-emerald-700" : "flex items-center gap-2"}>
            {confirmOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            <span>Confirmacao igual a senha</span>
          </div>
        )}
      </div>
    </div>
  );
}
