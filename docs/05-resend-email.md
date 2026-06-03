# E-mails com Resend

O projeto usa Resend para e-mails.

## Tipos

### Autenticacao

- Verificacao de e-mail: `lib/verify-email-mail.ts`.
- Reset de senha: `lib/password-reset-mail.ts`.

### Reservas

- Criacao.
- Remarcacao.
- Cancelamento.
- Lembrete.

Arquivo:

- `lib/mail.ts`.

E-mails de reserva sao melhor esforco: se falharem, a reserva continua salva.

## Variaveis

```env
RESEND_API_KEY="re_..."
EMAIL_FROM="Agenda Peterfrut <agenda@dominio-verificado.com>"
NEXT_PUBLIC_APP_URL="https://agenda.suaempresa.com"
```

## Configurar

1. Criar conta no Resend.
2. Verificar dominio.
3. Configurar DNS.
4. Gerar API key.
5. Configurar `RESEND_API_KEY`.
6. Configurar `EMAIL_FROM`.

## Testar

1. Criar usuario e receber verificacao.
2. Solicitar reset de senha.
3. Criar reserva.
4. Adicionar participante.

## Erros comuns

### `API key is invalid`

Causa:

- chave invalida, revogada ou ausente.

Solucao:

- gerar nova chave;
- atualizar variavel;
- reiniciar servidor.

### Link aponta para localhost

Corrigir:

```env
NEXT_PUBLIC_APP_URL="https://agenda.suaempresa.com"
```

## Imagens nos e-mails

Arquivos usados:

- `public/logo_peterfrut.png`
- `public/qr/*`
