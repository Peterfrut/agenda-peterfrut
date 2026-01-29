# Jobs e Cron

## Job de lembretes

Endpoint:
- `GET /api/jobs/remidenrs`

O job:
- Busca `Booking` com `status = pending` e `reminderSent = false`
- Envia lembrete para reservas com início dentro de **15 minutos**
- Marca `reminderSent = true`

## Como agendar

Você precisa de um disparador externo (cron):

- Vercel Cron
- GitHub Actions schedule
- UptimeRobot (HTTP monitor)
- Cloudflare Cron Triggers

Frequência recomendada: **a cada 5 minutos**.

## Segurança

Recomendado proteger este endpoint com um segredo de job (ex.: header com token), para evitar abusos.

Sugestão de implementação:
- Criar `JOB_SECRET` no `.env`
- Exigir `Authorization: Bearer <JOB_SECRET>` no endpoint
