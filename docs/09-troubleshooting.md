# Troubleshooting

## Erros de build

- `Type error: ... string | undefined`:
  - Geralmente é incompatibilidade de tipos em props/handlers. Ajustar assinatura para aceitar `string | undefined` ou normalizar antes de passar.

## Prisma

- `P1001 Can't reach database server`:
  - Verificar `DATABASE_URL`, rede e allowlist.

- `P2002 Unique constraint failed`:
  - Ex.: e-mail duplicado em `User.email`.

## Resend

- `401 Unauthorized`:
  - `RESEND_API_KEY` inválida.

- E-mail não chega:
  - Verificar domínio, SPF/DKIM e logs do Resend.

## Next.js API Routes

- Se endpoints retornarem 500:
  - Ver logs do servidor, principalmente ao acessar DB ou enviar e-mail.
