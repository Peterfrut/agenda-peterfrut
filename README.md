# Agenda Peterfrut

O **Agenda Peterfrut** é uma aplicação web full-stack desenvolvida para centralizar e organizar o agendamento de salas e compromissos corporativos, substituindo o uso de múltiplas agendas do Google e eliminando conflitos de horário.

O projeto resolve um problema real de negócio e foi concebido com foco em **consistência de dados, clareza visual, prevenção de conflitos e escalabilidade futura**.

---

## 🎯 Objetivo do Projeto

Substituir o uso de várias contas Google Calendar (uma por sala) por um **sistema único**, confiável e de fácil uso, onde:

- Todos conseguem ver claramente quando uma sala está ocupada
- É possível identificar quem realizou o agendamento
- Conflitos de horário são automaticamente bloqueados
- Agendamentos recorrentes são tratados corretamente
- Usuários recebem notificações por e-mail

---

## 🧠 Problema de Negócio

Antes do projeto:
- Pessoas iam até a sala acreditando que estava livre
- Existiam **6 contas Gmail diferentes**, uma por sala
- Dificuldade de manutenção e baixa confiabilidade
- Falta de uma visão centralizada dos agendamentos

O Agenda Peterfrut resolve esses pontos centralizando tudo em um único sistema.

---

## 🏗️ Arquitetura Geral

Arquitetura **full-stack monorepo**, baseada em Next.js:

Client (React / Next.js App Router)
↓
API Routes (Next.js)
↓
Camada de regras de negócio
↓
Prisma ORM
↓
PostgreSQL


### Motivações da arquitetura
- Redução de complexidade operacional
- Deploy unificado
- Tipagem forte end-to-end (TypeScript)
- Facilidade de evolução e manutenção

---

## 🛠️ Stack Tecnológica

### Frontend
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- SWR (cache e revalidação)
- date-fns

### Backend
- Next.js API Routes
- Prisma ORM
- Zod (validação de dados)
- JWT (autenticação)
- Rate limiting por usuário

### Banco de Dados
- PostgreSQL

### Integrações
- Resend (e-mails transacionais)
- BrasilAPI (feriados nacionais, com cache)

---

## 🗂️ Modelagem de Dados

### Booking
Representa **um único evento**.

> Eventos recorrentes são **materializados**: cada ocorrência vira um registro independente.

**Vantagens**
- Consultas simples
- Facilidade para editar ou excluir
- Menos lógica em tempo de leitura

**Trade-off**
- Mais registros no banco, aceitável para o volume esperado

---

### Holiday
- Feriados nacionais: carregados via BrasilAPI
- Feriados locais/sala: armazenados no banco

Regras:
- Feriados nacionais bloqueiam agendamento
- Feriados locais apenas exibem aviso visual

---

## 🔁 Recorrência

Tipos suportados:
- `daily`
- `weekly`
- `monthly`
- `weeklyByDay`

Regras:
- Expansão ocorre **no momento da criação**
- Limite máximo de ocorrências
- Repetição diária ignora:
  - Finais de semana
  - Feriados nacionais
- Validação de conflitos para **todas as ocorrências**
- Criação feita em **transação atômica**

---

## ⛔ Prevenção de Conflitos

- Verificação de sobreposição de horários
- Conflito bloqueia toda a operação
- Garantia de consistência

> Decisão consciente: consistência > conveniência parcial

---

## 📆 Visualizações do Calendário

O sistema oferece três modos de visualização:

- **Mês**: visão geral com eventos e feriados
- **Semana**: dias em colunas e horários em linhas
- **Dia**: foco completo em um único dia

Funcionalidades:
- Botão **Hoje**
- Navegação por setas (chevrons)
- Clique direto no grid para criar agendamentos
- Seleção visual do dia ativo

---

## 🗓️ Agenda Pessoal

Além das salas, o sistema possui uma **Agenda Pessoal**:

- Mostra:
  - Agendamentos criados pelo usuário
  - Agendamentos onde foi adicionado como participante
- Pode ser usada para eventos que não dependem de salas
- Facilita a visão consolidada do dia a dia do usuário

---

## 📬 E-mails Automáticos

E-mails são enviados automaticamente em caso de:
- Criação
- Remarcação
- Cancelamento

Características:
- HTML responsivo
- QR Code por sala
- Links absolutos (compatíveis com clientes de e-mail)
- Envio para organizador e participantes

---

## 🔐 Autenticação e Permissões

- Cadastro e login obrigatórios
- JWT para autenticação
- Apenas o criador pode:
  - Remarcar
  - Excluir agendamentos

> Atualmente não há perfil de administrador, por decisão arquitetural.
> A estrutura permite implementação futura sem breaking changes.

---

## 🖥️ Compatibilidade

⚠️ **Importante**

O sistema foi desenvolvido e testado **prioritariamente para desktop**.

- Pode ser acessado em outros dispositivos
- Porém, a interface **ainda não está otimizada para mobile**
- Podem ocorrer inconsistências visuais fora do desktop

---

## 🚀 Estado Atual do Projeto

- Em uso real para testes internos
- Estrutura estável
- Código organizado e extensível
- Preparado para evolução futura

---

## 🔮 Próximos Passos Possíveis

- Otimização para mobile
- Painel administrativo
- Observabilidade e logs
- Lembretes automáticos
- Perfis de usuário (admin)

---

## 👨‍💻 Destaque Técnico

Este projeto demonstra:
- Tradução de problema real em solução técnica
- Tomada consciente de decisões arquiteturais
- Equilíbrio entre simplicidade e escalabilidade
- Experiência full-stack completa
- Código orientado à manutenção e evolução

---

## 📄 Licença

Projeto público para fins de demonstração técnica e uso interno.





