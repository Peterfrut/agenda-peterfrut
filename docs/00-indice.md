# Documentação Operacional — Agenda Peterfrut

Este diretório contém a documentação mínima para que qualquer pessoa consiga:

- Subir o projeto localmente
- Entender a arquitetura e os principais módulos
- Operar o ambiente (Supabase/DB, Resend/e-mails, jobs)
- Investigar erros comuns e executar manutenção

## Conteúdo

1. [01-setup-local.md](./01-setup-local.md)
2. [02-variaveis-ambiente.md](./02-variaveis-ambiente.md)
3. [03-arquitetura.md](./03-arquitetura.md)
4. [04-supabase-postgres.md](./04-supabase-postgres.md)
5. [05-resend-email.md](./05-resend-email.md)
6. [06-jobs-e-cron.md](./06-jobs-e-cron.md)
7. [07-deploy.md](./07-deploy.md)
8. [08-runbook-manutencao.md](./08-runbook-manutencao.md)
9. [09-troubleshooting.md](./09-troubleshooting.md)

## Convenções

- Tudo que é segredo fica em `.env` (use `.env.example` como referência).
- Alterações relevantes de arquitetura devem ser registradas como ADRs (opcional): `docs/adr/`.
