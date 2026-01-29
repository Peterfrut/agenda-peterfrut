# Variáveis de ambiente

## Obrigatórias

- `DATABASE_URL`
  - String de conexão Postgres (Supabase). O Prisma usa esta variável.
- `JWT_SECRET`
  - Segredo para assinatura/validação de JWT.
- `NEXT_PUBLIC_APP_URL`
  - URL pública do app (sem barra no final). Usada para links absolutos nos e-mails.
- `RESEND_API_KEY`
  - Chave da API do Resend.
- `EMAIL_FROM`
  - Remetente padrão usado nos e-mails.

## Opcionais

- `TEAMS_LINK_SALA_REUNIAO`
- `TEAMS_LINK_AUDITORIO`

Esses links são usados em `lib/mail.ts` (mapeamento por `roomId`).

## Boas práticas

- Não comitar `.env`.
- Rotacionar segredos (Resend e `JWT_SECRET`) se houver suspeita de vazamento.
- Para produção, preferir variáveis no provedor (Vercel/Render/Fly/etc.) e nunca em arquivos.
