# Runbook de manutencao

## Usuarios nao conseguem logar

Verificar no banco:

- `active = true`
- `emailVerifiedAt` preenchido
- `verified = true`
- `role` correto

Verificar ambiente:

- `JWT_SECRET` configurado.
- app reiniciado apos trocar variaveis.

## Usuario nao consegue agendar

Verificar:

1. Usuario ativo e verificado.
2. Sala existe em `lib/rooms.ts`.
3. Horario entre `06:00` e `17:30`.
4. Horario em passos de 30 minutos.
5. Sem conflito na mesma sala e data.
6. Nao e feriado nacional.
7. Logs de `/api/bookings`.

Erro conhecido:

```text
Failed to deserialize column of type 'void'
```

Correcao:

- usar `$executeRaw`, nao `$queryRaw`, com `pg_advisory_xact_lock`.

## E-mails nao chegam

Verificar:

- `RESEND_API_KEY`;
- `EMAIL_FROM`;
- dominio verificado;
- logs do servidor;
- painel do Resend.

Erro:

```text
API key is invalid
```

Solucao:

- gerar nova chave;
- atualizar variavel;
- reiniciar app.

## Reset de senha

Verificar:

- token nao expirou;
- token nao foi usado;
- usuario ativo;
- Resend funcionando;
- `NEXT_PUBLIC_APP_URL` correto.

Senha forte:

- minimo 10 caracteres;
- 1 letra maiuscula;
- 1 numero;
- 1 simbolo.

## Job de lembrete

Verificar:

- cron ativo;
- `CRON_SECRET`;
- header correto;
- reservas nos proximos 15 minutos;
- `reminderSent = false`.

## Importacao ICS

Verificar:

- usuario admin;
- arquivo `.ics`;
- arquivo ate 5 MB;
- sala valida;
- eventos com `start`, `end` e `uid`.
