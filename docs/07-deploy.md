# Deploy

## Checklist

- Variáveis de ambiente configuradas no provedor
- `NEXT_PUBLIC_APP_URL` apontando para o domínio final
- Migrações aplicadas (`npx prisma migrate deploy`)
- Verificar domínio de e-mail no Resend (DNS)
- Garantir que o cron de lembretes está ativo

## Build/Start

Scripts:

- `npm run build`
- `npm run start`

Observação: o `prebuild` executa `prisma generate`.

## Pós-deploy

- Criar um agendamento e confirmar envio de e-mail
- Acionar manualmente o endpoint de job (em ambiente controlado)
- Verificar logs de erros no provedor
