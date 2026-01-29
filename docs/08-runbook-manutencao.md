# Runbook de manutenção (o que fazer nas férias)

## Incidentes comuns

### 1) Usuários sem receber e-mail

Verificar, na ordem:

1. Variáveis `RESEND_API_KEY` e `EMAIL_FROM` no ambiente.
2. Domínio verificado no Resend.
3. Logs do servidor ao criar agendamento (erros de envio em `lib/mail.ts`).
4. Se o problema for apenas lembrete, checar cron (ver `docs/06-jobs-e-cron.md`).

### 2) Conflitos de agendamento aparecendo

1. Confirmar que a validação de overlap está rodando no endpoint de criação.
2. Verificar timezone/formato: `Booking.date` é `YYYY-MM-DD` e horas são `HH:MM`.
3. Consultar no banco se existem duplicidades.

### 3) Job de lembretes não dispara

1. Verificar se o cron está ativo.
2. Chamar manualmente `GET /api/jobs/remidenrs`.
3. Verificar se existem bookings com `reminderSent=false` próximos.

## Operações de rotina

- Rotação de segredos (se necessário)
- Aplicar migrations (somente via `prisma migrate deploy`)
- Backups e restauração (procedimento no Supabase)

## Acesso

Manter um local seguro com:

- Acesso ao provedor de deploy
- Acesso ao Supabase
- Acesso ao Resend
