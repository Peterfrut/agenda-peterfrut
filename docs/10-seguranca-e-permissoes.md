# Seguranca e permissoes

## Autenticacao

O sistema usa:

- e-mail corporativo;
- senha com hash bcrypt;
- JWT;
- cookie HTTP-only;
- expiracao de 8 horas.

Tokens de verificacao de e-mail e redefinicao de senha sao enviados no link, mas gravados no banco apenas como hash SHA-256. A consulta aceita hash novo e token legado em texto puro para nao invalidar links emitidos antes da melhoria.

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
- `GET /api/audit-logs`

O backend consulta o banco para confirmar role atual.

## CSRF e Origin

`proxy.ts` valida `Origin` ou, quando `Origin` nao existe, `Referer` em:

- `POST`
- `PATCH`
- `DELETE`

Se o host nao bater com o host da aplicacao, bloqueia. Requisicoes unsafe sem `Origin` e sem `Referer` tambem sao bloqueadas, exceto o job de cron, que usa `CRON_SECRET`.

## Headers de seguranca

O projeto envia headers de defesa basica:

- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `X-Frame-Options: DENY`;
- `Permissions-Policy` bloqueando camera, microfone e geolocalizacao;
- `Content-Security-Policy` com `base-uri 'self'`, `object-src 'none'` e `frame-ancestors 'none'`.

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

A rota de cron e liberada do login por cookie no `proxy.ts`, mas continua protegida pelo segredo no proprio handler.

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

## Logs de auditoria

O sistema possui trilha de auditoria em `AuditLog`.

Acesso:

- somente admin;
- exibido na pagina de usuarios, aba `Logs do sistema`;
- endpoint `GET /api/audit-logs`.

Eventos registrados:

- login bem-sucedido, falha de login, login bloqueado e logout;
- cadastro, confirmacao de e-mail e reset de senha;
- atualizacao e exclusao de usuarios;
- criacao, edicao, remarcacao e exclusao de agendamentos;
- solicitacoes de convidados;
- importacao ICS.

Cuidados de seguranca:

- senha, token, cookie, segredo, authorization e URLs sensiveis nao sao gravados nos metadados;
- metadados sao limitados em tamanho e profundidade;
- falha ao gravar log nao bloqueia a acao principal;
- logs devem ser usados para auditoria administrativa, nao para armazenar stack trace ou dados sensiveis.

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
