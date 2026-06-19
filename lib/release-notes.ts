export type ReleaseNote = {
  id: string;
  version: string;
  publishedAt: string;
  title: string;
  items: string[];
  examples: Array<{
    title: string;
    description: string;
    steps: string[];
  }>;
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: "2026-06-17-guests-notifications-mobile",
    version: "1.1.0",
    publishedAt: "2026-06-17T12:00:00.000Z",
    title: "Convidados, notificacoes e melhorias de uso",
    items: [
      "Edicao segura de convidados em reservas existentes.",
      "Justificativa obrigatoria para reservas longas ou recorrencias altas.",
      "Busca de usuarios cadastrados ao adicionar convidados, mantendo suporte a e-mails externos.",
      "Sugestoes de remarcacao para convidados e ausencia registrada sem aprovacao.",
      "Central de notificacoes e pagina de atualizacoes do sistema.",
      "Tela inicial direcionada para selecao de sala e ajustes para uso mobile.",
    ],
    examples: [
      {
        title: "Editar um agendamento",
        description: "Use quando precisar corrigir o titulo, explicar melhor uma reserva longa ou ajustar convidados.",
        steps: [
          "Abra o detalhe da reserva ou o card em Horarios Agendados.",
          "Clique no botao de editar.",
          "Altere titulo, justificativa ou convidados e salve.",
        ],
      },
      {
        title: "Adicionar convidados cadastrados ou externos",
        description: "O campo aceita busca por nome/e-mail interno e tambem e-mails externos digitados manualmente.",
        steps: [
          "Digite pelo menos duas letras do nome ou e-mail.",
          "Escolha um usuario sugerido ou digite o e-mail completo.",
          "Use o botao de adicionar e depois salve o agendamento.",
        ],
      },
      {
        title: "Justificar reserva longa",
        description: "Reservas acima de 3 horas ou recorrencias acima de 20 ocorrencias pedem justificativa.",
        steps: [
          "Escolha um intervalo longo ou uma recorrencia extensa.",
          "Preencha o campo Justificativa que aparece no formulario.",
          "A justificativa fica visivel nos detalhes e no card da reserva para quem tem permissao.",
        ],
      },
      {
        title: "Convidado nao vai comparecer",
        description: "O convidado pode sair da reserva sem precisar de aprovacao do responsavel.",
        steps: [
          "Abra o detalhe da reserva como convidado.",
          "Clique em Nao vou comparecer.",
          "Informe uma observacao; o responsavel recebe notificacao e voce sai da agenda da reuniao.",
        ],
      },
      {
        title: "Sugerir remarcacao",
        description: "A sugestao avisa o responsavel, mas nao muda o horario da reuniao automaticamente.",
        steps: [
          "Abra o detalhe da reserva como convidado.",
          "Clique em Solicitar remarcacao e informe data/horario sugeridos.",
          "O responsavel decide se vai remarcar pelo botao normal de reagendamento.",
        ],
      },
      {
        title: "Usar notificacoes",
        description: "O sino mostra ate 10 notificacoes recentes sem bloquear a tela.",
        steps: [
          "Clique no sino ao lado dos botoes Dia, Semana e Mes no cabecalho do calendario.",
          "Clique em uma notificacao para marcar como lida.",
          "Use Ver detalhes para abrir a pagina completa de notificacoes.",
        ],
      },
      {
        title: "Selecionar sala ao entrar",
        description: "Ao acessar a agenda sem sala selecionada, uma tela inicial orienta a escolha.",
        steps: [
          "Escolha uma sala na tela inicial.",
          "Escolha a sala ou Agenda Pessoal.",
          "A agenda e a lista de horarios carregam automaticamente.",
        ],
      },
    ],
  },
];

export const LATEST_RELEASE_NOTE = RELEASE_NOTES[0];
