# Supabase (Postgres)

## O que este projeto usa

- Supabase como Postgres gerenciado.
- Prisma como ORM/migrations.

## Conectar e aplicar migrations

1) Obter a string `DATABASE_URL` no Supabase.
2) Configurar `.env` local e/ou variáveis do ambiente de produção.
3) Aplicar migrations:

```bash
npx prisma migrate deploy
```

## Operação

- Backups: usar rotina do Supabase (ou backup externo) — documentar periodicidade.
- Monitorar conexões: se usar pooler/pgbouncer, garanta parâmetros compatíveis.
- Mudanças de schema:
  - Em dev: `npx prisma migrate dev --name <nome>`
  - Em prod: `npx prisma migrate deploy` (nunca `migrate dev`).

## Itens para auditoria

- Índices existentes (ver `schema.prisma`):
  - `Holiday`: índices por `(roomId, date)` e por `date`
  - Tokens: índices por `userId` e `expiresAt`
