# Variaveis de ambiente

## Obrigatorias

- `DATABASE_URL`
  - String de conexao Postgres. O Prisma usa esta variavel.
- `JWT_SECRET`
  - Segredo para assinatura/validacao de JWT. Use uma string aleatoria longa, com pelo menos 32 caracteres.
- `NEXT_PUBLIC_APP_URL`
  - URL publica do app, com protocolo e sem barra no final. Exemplo: `https://agenda.exemplo.com`.
- `RESEND_API_KEY`
  - Chave da API do Resend.
- `EMAIL_FROM`
  - Remetente padrao usado nos e-mails.

## Opcionais

- `TEAMS_LINK_SALA_REUNIAO_SUP`
- `TEAMS_LINK_SALA_REUNIAO_INF`
- `TEAMS_LINK_AUDITORIO`
- `CRON_SECRET`

Os links do Teams sao usados em `lib/mail.ts` por `roomId`. `CRON_SECRET` protege o endpoint de lembretes em producao.

## Boas praticas

- Nao comitar `.env`.
- Nao guardar backups compactados do projeto com `.env` dentro do repositorio.
- Rotacionar `DATABASE_URL`, `RESEND_API_KEY` e `JWT_SECRET` se houver suspeita de vazamento.
- Para producao, preferir variaveis no provedor (Vercel/Render/Fly/etc.) e nunca em arquivos.
