# Banco, Prisma e Supabase

O projeto usa Postgres com Prisma ORM.

## Arquivos

- `prisma/schema.prisma`: modelos.
- `prisma/migrations/*`: migrations.
- `lib/prisma.ts`: client usado pela aplicacao.

## Comandos

Gerar client:

```bash
npx prisma generate
```

Criar/aplicar migration em desenvolvimento:

```bash
npx prisma migrate dev --name nome_da_migration
```

Aplicar migrations em producao:

```bash
npx prisma migrate deploy
```

Abrir Prisma Studio:

```bash
npx prisma studio
```

Status:

```bash
npx prisma migrate status
```

## Migrations importantes

- `20251222134657_init`: estrutura inicial.
- `20251223113933_add_holidays`: feriados.
- `20251223170426_add_user_roles`: roles.
- `20260225110601_add_ics_import_fields`: campos ICS.
- `20260225180247_booking_external_fields`: ajustes de booking.
- `20260601120000_scope_booking_external_id_by_room`: unicidade ICS por sala.
- `20260601123000_add_user_active_flag`: campo `User.active`.

## Cuidados

### `User.active`

Campo usado para bloquear usuario. Se a migration nao foi aplicada, login e agendamento podem falhar.

### `Booking.provider`, `roomId`, `externalId`

Existe constraint unica:

```prisma
@@unique([provider, roomId, externalId])
```

Isso evita duplicidade de eventos importados por sala.

### Datas e horas

O sistema salva:

- `date` como `YYYY-MM-DD`;
- `startTime` e `endTime` como `HH:MM`.

## Producao

- Nunca usar `prisma migrate dev` em producao.
- Usar `prisma migrate deploy`.
- Conferir backup no Supabase.
- Depois de mudar schema, rodar `npx prisma generate`.
