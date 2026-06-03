# Seguranca e permissoes

## Autenticacao

O sistema usa:

- e-mail corporativo;
- senha com hash bcrypt;
- JWT;
- cookie HTTP-only;
- expiracao de 8 horas.

## Senha forte

Cadastro e reset usam a mesma regra:

- minimo 10 caracteres;
- 1 letra maiuscula;
- 1 numero;
- 1 simbolo.

Implementacao:

- `lib/formatters.ts`
- `app/components/PasswordRules.tsx`

## Usuario ativo e verificado

Para acessar APIs protegidas:

- usuario existe no banco;
- `active = true`;
- `emailVerifiedAt` preenchido.

## Roles

- `user`: usuario comum.
- `admin`: gerencia usuarios e importa ICS.

Endpoints admin:

- `GET /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`
- `POST /api/import`

O backend consulta o banco para confirmar role atual.

## CSRF e Origin

`proxy.ts` valida `Origin` em:

- `POST`
- `PATCH`
- `DELETE`

Se o host nao bater com o host da aplicacao, bloqueia.

## Rate limit

Rotas sensiveis possuem rate limit em memoria:

- login;
- cadastro;
- forgot password;
- resend verification;
- reset password;
- reservas.

## Importacao ICS

Somente admin.

Limites:

- arquivo `.ics`;
- ate 5 MB;
- ate 5000 eventos;
- sala valida;
- agenda pessoal nao recebe ICS.

## Job de lembrete

Em producao exige `CRON_SECRET`.

Headers:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

## Checklist de producao

- HTTPS ativo.
- `JWT_SECRET` forte.
- `CRON_SECRET` configurado.
- `RESEND_API_KEY` valida.
- Banco com senha forte.
- Migrations aplicadas.
- Admins limitados.
- Backups configurados.
- `.env` fora do Git.
