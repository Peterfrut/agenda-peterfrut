# Variaveis de ambiente

Configure localmente no `.env` e em producao no provedor de deploy.

## Obrigatorias

### `DATABASE_URL`

String de conexao Postgres usada pelo Prisma.

```env
DATABASE_URL="postgresql://usuario:senha@host:5432/banco?schema=public"
```

### `JWT_SECRET`

Segredo para assinar JWT. Deve ter pelo menos 32 caracteres.

```env
JWT_SECRET="uma-string-grande-e-aleatoria"
```

### `NEXT_PUBLIC_APP_URL`

URL publica do app.

Local:

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Producao:

```env
NEXT_PUBLIC_APP_URL="https://agenda.suaempresa.com"
```

### `RESEND_API_KEY`

Chave do Resend.

```env
RESEND_API_KEY="re_..."
```

Erro comum:

```text
API key is invalid
```

Nesse caso, gere uma nova chave no Resend e reinicie o servidor.

### `EMAIL_FROM`

Remetente dos e-mails.

```env
EMAIL_FROM="Alias <agenda@dominio-verificado.com>"
```

O dominio precisa estar verificado no Resend.

## Recomendadas

### `CRON_SECRET`

Protege o endpoint de lembretes.

```env
CRON_SECRET="segredo-forte"
```

### Links do Teams

```env
TEAMS_LINK_SALA_REUNIAO_SUP="https://..."
TEAMS_LINK_SALA_REUNIAO_INF="https://..."
TEAMS_LINK_AUDITORIO="https://..."
```

## Onde sao usadas

- `lib/auth.ts`: `JWT_SECRET`.
- `lib/security.ts`: `NEXT_PUBLIC_APP_URL`.
- `lib/mailer.ts`: `RESEND_API_KEY`, `EMAIL_FROM`.
- `lib/mail.ts`: links do Teams.
- `app/api/jobs/remidenrs/route.ts`: `CRON_SECRET`.

## Boas praticas

- Nao comitar `.env`.
- Nao colocar segredo em variavel `NEXT_PUBLIC_*`.
- Rotacionar segredos em caso de vazamento.
- Reiniciar o servidor depois de mudar variaveis.
