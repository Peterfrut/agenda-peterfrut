# Deploy

## Checklist

1. Configurar variaveis:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NEXT_PUBLIC_APP_URL`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `CRON_SECRET`
2. Confirmar banco acessivel.
3. Confirmar dominio no Resend.
4. Rodar lint.
5. Rodar build.
6. Aplicar migrations.

## Comandos

```bash
npm run lint
npm run build
npx prisma migrate deploy
npm run start
```

## Ordem recomendada

1. Configurar variaveis no provedor.
2. Fazer deploy.
3. Rodar migrations.
4. Reiniciar app se necessario.
5. Testar login.
6. Testar reserva.
7. Testar reset de senha.
8. Testar job de lembrete.

## Windows

Erro:

```text
EPERM ... query_engine-windows.dll.node
```

Causa provavel:

- servidor dev usando Prisma Client.

Solucao:

1. Parar `npm run dev`.
2. Fechar processos Node.
3. Rodar build novamente.
