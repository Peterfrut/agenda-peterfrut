# Setup local (onboarding rápido)

## Pré-requisitos

- Node.js LTS (recomendado 20+)
- npm, pnpm ou yarn (o projeto usa `npm` nos scripts)
- Acesso ao Supabase (ou um Postgres local)

## Passo a passo

1) **Instalar dependências**

```bash
npm install
```

2) **Criar `.env`**

- Copie `.env.example` para `.env`.
- Preencha `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` e `NEXT_PUBLIC_APP_URL`.

3) **Gerar Prisma Client**

```bash
npx prisma generate
```

4) **Aplicar migrations**

Se estiver apontando para um banco vazio:

```bash
npx prisma migrate deploy
```

5) **Rodar em desenvolvimento**

```bash
npm run dev
```

A aplicação sobe em `http://localhost:3000`.

## Smoke tests (o que validar)

- Criar usuário e fazer login
- Criar um agendamento em uma sala
- Confirmar que conflito de horário é bloqueado
- Validar envio de e-mail (criação e lembrete)
- Verificar carregamento/uso de feriados
