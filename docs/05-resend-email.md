# Resend (e-mails)

## Onde está a integração

- `lib/mailer.ts`
  - Inicializa `Resend` com `RESEND_API_KEY`.
  - Define `getFromEmail()` com fallback.
- `lib/mail.ts`
  - Monta HTML dos e-mails, subject e destinatários.

## Tipos de e-mail

- `created`: criação
- `updated`: remarcação
- `canceled`: cancelamento
- `reminder`: lembrete

## Requisitos em produção

- `NEXT_PUBLIC_APP_URL` deve ser HTTPS e apontar para o domínio real.
- `EMAIL_FROM` deve estar configurado e o domínio deve estar verificado no Resend (DNS).

## Testes

- Validar em dev com um destinatário controlado.
- Em caso de falhas, verificar logs do provedor e também logs do servidor (API Route).

## Rotação de chave

- Se a chave vazar, revogue a antiga no Resend e gere uma nova.
- Atualize imediatamente as variáveis no ambiente de produção.
