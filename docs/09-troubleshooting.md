# Troubleshooting

## Prisma

### `DATABASE_URL resolved to an empty string`

Configure:

```env
DATABASE_URL="postgresql://..."
```

Depois:

```bash
npx prisma generate
```

### `P1001 Can't reach database server`

Verificar:

- host;
- senha;
- rede;
- allowlist;
- pooler do Supabase.

### `P2002 Unique constraint failed`

Casos comuns:

- `User.email` duplicado.
- evento ICS duplicado.

### `Failed to deserialize column of type 'void'`

Causa:

- `$queryRaw` com funcao Postgres que retorna `void`.

Correto:

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}))`;
```

## Resend

### `API key is invalid`

Gerar nova chave no Resend, atualizar variavel e reiniciar servidor.

### E-mail nao chega

Verificar:

- spam;
- dominio;
- `EMAIL_FROM`;
- logs do Resend;
- logs do servidor.

## Autenticacao

### Usuario loga mas nao acessa agenda

Verificar:

- `active = true`;
- `emailVerifiedAt` preenchido.

### Erro 401 em APIs

Possiveis causas:

- cookie ausente;
- token expirado;
- usuario inativo;
- usuario sem e-mail verificado.

## Agendamento

### Erro 409

Pode ser:

- conflito de horario;
- feriado nacional;
- recorrencia sem ocorrencias validas.

### Erro 500

Ver logs do servidor. Possiveis causas:

- migration pendente;
- banco indisponivel;
- erro de Prisma.

## Build

### `EPERM ... query_engine-windows.dll.node`

Pare `npm run dev`, feche processos Node e rode build novamente.
