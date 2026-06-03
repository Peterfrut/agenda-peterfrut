# Setup local

## Pre-requisitos

- Node.js 20 ou superior.
- npm.
- Acesso a um Postgres, preferencialmente Supabase.
- Chave do Resend para testar e-mail.

## 1. Instalar dependencias

```bash
npm install
```

## 2. Criar `.env`

Use `dev_local_example.env` como base.

Exemplo minimo:

```env
DATABASE_URL="postgresql://usuario:senha@host:5432/banco?schema=public"
JWT_SECRET="uma-string-aleatoria-com-mais-de-32-caracteres"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RESEND_API_KEY="re_..."
EMAIL_FROM="Alias <email@dominio-verificado.com>"
CRON_SECRET="um-segredo-para-o-job"
```

## 3. Gerar Prisma Client

```bash
npx prisma generate
```

## 4. Aplicar migrations

Desenvolvimento:

```bash
npx prisma migrate dev
```

Producao:

```bash
npx prisma migrate deploy
```

Importante: se a migration do campo `User.active` nao estiver aplicada, login e agendamento podem falhar.

## 5. Rodar localmente

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## 6. Criar primeiro admin

O cadastro cria usuario comum. Para criar o primeiro admin, use Prisma Studio:

```bash
npx prisma studio
```

No usuario desejado:

- `role = admin`
- `active = true`
- `verified = true`
- `emailVerifiedAt` preenchido

Ou via SQL:

```sql
UPDATE "User"
SET role = 'admin',
    active = true,
    verified = true,
    "emailVerifiedAt" = NOW()
WHERE email = 'usuario@mail.com.br';
```

## Smoke test

1. Criar usuario.
2. Verificar e-mail ou marcar como verificado no banco.
3. Fazer login.
4. Criar reserva.
5. Tentar criar reserva no mesmo horario.
6. Acessar `/users` com admin.
7. Ativar/inativar usuario.
8. Testar reset de senha.
