# Fluxo de documentacao

Este projeto deve manter a documentacao junto com as mudancas de codigo.

## Quando atualizar

Atualize a documentacao sempre que uma mudanca alterar:

- comportamento de telas;
- regras de agendamento;
- permissoes;
- variaveis de ambiente;
- banco de dados ou migrations;
- envio de e-mails;
- fluxos de usuario;
- rotas de API;
- jobs ou rotinas de manutencao.

## Onde documentar

- Mudancas visiveis para usuario: `lib/release-notes.ts`.
- Procedimentos operacionais: `docs/08-runbook-manutencao.md`.
- Seguranca e permissoes: `docs/10-seguranca-e-permissoes.md`.
- Banco e migrations: `docs/04-supabase-postgres.md`.
- Novos fluxos amplos: criar ou atualizar um arquivo em `docs/`.

## Checagem automatica

O comando abaixo verifica se houve mudanca em `app/`, `lib/` ou `prisma/` sem alguma atualizacao de documentacao:

```bash
npm run docs:check
```

Essa checagem tambem roda no GitHub Actions em pull requests pelo workflow `.github/workflows/docs-check.yml`.

## Como trabalhar no dia a dia

1. Implemente a funcionalidade.
2. Atualize os docs ou `lib/release-notes.ts`.
3. Rode:

```bash
npm run lint
npm run docs:check
npm run build
```

4. Se existir migration, aplique no ambiente correto antes de testar com dados reais.

## Observacao importante

O script nao escreve documentacao sozinho. Ele funciona como uma trava para evitar esquecer a documentacao quando o codigo muda. A descricao da regra e do comportamento ainda deve ser escrita por quem implementou a mudanca.
