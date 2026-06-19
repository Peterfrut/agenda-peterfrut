# Agenda Peterfrut - Documentacao

Este diretorio documenta o sistema interno de agendamento de salas da empresa.

O objetivo do projeto e centralizar as reservas de salas, agenda pessoal, usuarios, e-mails e importacoes de agenda em uma unica aplicacao.

## Leitura recomendada

1. [Setup local](./01-setup-local.md)
2. [Variaveis de ambiente](./02-variaveis-ambiente.md)
3. [Arquitetura](./03-arquitetura.md)
4. [Banco, Prisma e Supabase](./04-supabase-postgres.md)
5. [E-mails com Resend](./05-resend-email.md)
6. [Jobs e cron](./06-jobs-e-cron.md)
7. [Deploy](./07-deploy.md)
8. [Runbook de manutencao](./08-runbook-manutencao.md)
9. [Troubleshooting](./09-troubleshooting.md)
10. [Seguranca e permissoes](./10-seguranca-e-permissoes.md)
11. [Fluxo de documentacao](./11-fluxo-de-documentacao.md)

## Stack

- Next.js App Router
- React
- Prisma ORM
- Postgres/Supabase
- Resend
- JWT em cookie HTTP-only
- Zod
- SWR

## Pastas importantes

- `app/`: telas, componentes e rotas.
- `app/api/`: backend da aplicacao.
- `lib/`: regras compartilhadas, Prisma, auth, e-mail e seguranca.
- `prisma/`: schema e migrations.
- `public/`: imagens, logo, manifest e QR codes.
- `docs/`: documentacao operacional.

## Regras de manutencao

- Nao comitar `.env`.
- Nao subir `.zip`, `.rar` ou `.7z` com segredos.
- Toda alteracao de banco deve ter migration.
- Depois de alterar Prisma, rodar `npx prisma generate`.
- Antes de publicar, rodar `npm run lint` e `npm run build`.
- Para nao esquecer docs em mudancas de codigo, rodar `npm run docs:check`.
