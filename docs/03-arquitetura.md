# Arquitetura

## Visão geral

- Next.js (App Router)
- API Routes no próprio Next.js
- Prisma ORM
- Postgres (Supabase)
- Resend para e-mails

## Pastas principais

- `app/`
  - Rotas, páginas e `app/api/*` (endpoints)
- `lib/`
  - Integrações e regras reutilizáveis
  - `lib/prisma.ts`: client Prisma
  - `lib/mailer.ts`: inicialização do Resend
  - `lib/mail.ts`: templates e orquestração de e-mails
- `prisma/`
  - `schema.prisma` e migrations
- `public/qr/`
  - QR codes por sala (usados em e-mails)

## Modelos (Prisma)

- `User`
  - Usuário com `verified`, `role` e tokens de verificação/reset
- `Booking`
  - Reserva materializada (cada ocorrência é um registro)
  - Campos relevantes: `roomId`, `date`, `startTime`, `endTime`, `status`, `reminderSent`
- `Holiday`
  - Feriados globais (roomId null) ou por sala

## Fluxos críticos

### Criação de agendamento

1. UI chama endpoint de criação.
2. Backend valida payload (Zod) e conflitos.
3. Cria registros (em transação quando recorrente).
4. Dispara e-mails via `sendBookingEmail`.

### E-mails

- A integração com Resend está centralizada em `lib/mailer.ts`.
- Conteúdo HTML e anexos inline (logo/QR) ficam em `lib/mail.ts`.

### Job de lembrete

- Endpoint GET: `app/api/jobs/remidenrs/route.ts`.
- Seleciona reservas futuras (janela de 15 min) e envia lembretes.
- Precisa ser acionado por cron externo.
