# Jobs e cron

O sistema possui job para enviar lembretes antes do horario da reserva.

Importante: Next.js nao executa esse job sozinho. Em producao, configure um agendador externo para chamar o endpoint com `CRON_SECRET`.

## Endpoint recomendado

```text
GET /api/jobs/reminders
POST /api/jobs/reminders
```

A rota antiga `/api/jobs/remidenrs` existe por compatibilidade.

## O que o job faz

1. Busca reservas:
  - `status = confirmed`
  - `reminderSent = false`
2. Filtra reservas que comecam nos proximos 10 minutos.
3. Marca `reminderSent = true`.
4. Envia e-mail.
5. Se falhar, volta `reminderSent = false`.

O calculo do horario usa explicitamente o fuso `America/Sao_Paulo`, para nao depender do timezone do servidor.

## Seguranca

Em producao:

```env
CRON_SECRET="segredo-forte"
```

Chamada:

```bash
curl -X POST "https://agenda.suaempresa.com/api/jobs/reminders" \
  -H "Authorization: Bearer seu-segredo"
```

Tambem aceita:

```bash
curl -X POST "https://agenda.suaempresa.com/api/jobs/reminders" \
  -H "x-cron-secret: seu-segredo"
```

## Frequencia

Recomendado:

```text
a cada 5 minutos
```

Pode usar:

- Vercel Cron
- GitHub Actions schedule
- UptimeRobot
- Cloudflare Cron Triggers
- cron interno

## Retorno esperado

```json
{
  "ok": true,
  "checked": 10,
  "reminded": 1,
  "windowMinutes": 10
}
```
