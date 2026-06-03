# Arquitetura

## Visao geral

```text
Usuario
  -> Next.js / React
  -> app/api/*
  -> Prisma
  -> Postgres/Supabase
  -> Resend
```

O frontend e o backend vivem no mesmo projeto Next.js.

## Frontend

Arquivos principais:

- `app/page.tsx`: tela inicial da agenda.
- `app/components/SchedulePage.tsx`: pagina principal da agenda.
- `app/components/BookingForm.tsx`: formulario de reserva.
- `app/components/BookingsList.tsx`: lista de reservas do dia.
- `app/users/*`: painel administrativo de usuarios.
- `app/import/page.tsx`: importacao ICS.
- `app/login`, `app/register`, `app/reset-password`: auth.

O frontend usa SWR para buscar dados e atualizar listas sem recarregar a pagina.

## Backend/API

Rotas principais:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/bookings`
- `PATCH /api/bookings`
- `DELETE /api/bookings`
- `GET /api/users`
- `PATCH /api/users/:id`
- `POST /api/import`
- `GET/POST /api/jobs/reminders`

## Libs internas

- `lib/prisma.ts`: Prisma Client.
- `lib/auth.ts`: JWT.
- `lib/api-auth.ts`: autenticacao por usuario real do banco.
- `lib/security.ts`: helpers de seguranca.
- `lib/rate-limit.ts`: rate limit simples.
- `lib/mail.ts`: e-mails de reserva.
- `lib/password-reset-mail.ts`: e-mail de reset.
- `lib/verify-email-mail.ts`: e-mail de verificacao.
- `lib/rooms.ts`: salas e expediente.
- `lib/time.ts`: validacao de horario.
- `lib/formatters.ts`: e-mail, senha e tokens.

## Modelos principais

### `User`

- `email`: unico.
- `password`: hash bcrypt.
- `role`: `user` ou `admin`.
- `active`: controla acesso.
- `verified`: marca verificacao.
- `emailVerifiedAt`: exigido para login/sessao.

Um usuario acessa APIs protegidas apenas se:

- JWT valido;
- existe no banco;
- `active = true`;
- `emailVerifiedAt` preenchido.

### `Booking`

Cada reserva e uma linha.

- `roomId`
- `roomName`
- `title`
- `date`: `YYYY-MM-DD`
- `startTime`: `HH:MM`
- `endTime`: `HH:MM`
- `userEmail`
- `participantsEmails`
- `status`: padrao `confirmed`
- `reminderSent`
- `provider`, `externalId`, `externalSource`

### `Holiday`

Feriados globais ou por sala.

- `roomId = null`: global.
- `roomId = <sala>`: sala especifica.

## Fluxo de reserva

1. Usuario abre a agenda.
2. Frontend chama `/api/auth/me`.
3. Frontend carrega reservas em `/api/bookings`.
4. Usuario envia formulario.
5. Backend valida payload com Zod.
6. Backend valida sala, horario, feriados e conflitos.
7. Backend abre transacao.
8. Backend usa `pg_advisory_xact_lock` com `$executeRaw`.
9. Backend cria reserva.
10. Backend tenta enviar e-mail.
11. Se o e-mail falhar, a reserva continua salva.

## Salas

Definidas em `lib/rooms.ts`.

Expediente:

```text
06:00 ate 17:30
```

Slots:

```text
30 minutos
```
