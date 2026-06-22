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

## Notificacoes internas

As notificacoes sao sempre buscadas pelo `userId` autenticado.

Cuidados implementados:

- `href` passa por `sanitizeNotificationHref`.
- links externos sao exibidos apenas se forem links do Teams permitidos em `lib/safe-links.ts`;
- `metadata` passa por sanitizacao em `lib/notifications.ts`;
- fallback de detalhes de remarcacao busca apenas solicitacoes do usuario autenticado ou reservas em que ele e responsavel;
- a interface renderiza os detalhes como texto React, sem HTML injetado;
- notificacoes antigas sem `metadata` exibem fallback quando a solicitacao correspondente ainda existe no banco;
- o polling do sino consulta somente `/api/notifications`, que ja filtra por usuario autenticado.

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
