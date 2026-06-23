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
      "Atualizacoes com topicos navegaveis e exemplos visuais por novidade.",
      "Ajuda visual com topicos expansivos e exemplos de uso por funcionalidade.",
      "Central de ajuda com transicoes suaves ao trocar abas, topicos e exemplos visuais.",
      "Pagina de notificacoes mais visual com badges por status.",
      "Detalhes por notificacao com sala, horario, responsavel, participantes e contexto da solicitacao.",
      "Detalhes de notificacao abrindo direto no sino da agenda, sem sair do calendario.",
      "Notificacoes atualizam automaticamente sem recarregar a pagina.",
      "Notificacoes internas para confirmacao, convite, remarcacao, cancelamento e lembrete de reuniao.",
      "Notificacoes de agendamento com botao para abrir Teams quando a sala tiver link configurado.",
      "Menu lateral em telas compactas fecha ao clicar fora ou escolher uma sala.",
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
        description: "O sino mostra ate 10 notificacoes recentes sem bloquear a tela e atualiza sozinho.",
        steps: [
          "Clique no sino ao lado dos botoes Dia, Semana e Mes no cabecalho do calendario.",
          "Aguarde alguns segundos para novas notificacoes aparecerem sem recarregar a pagina.",
          "Use Ver detalhes para abrir a ficha da notificacao ou Ver central para abrir a pagina completa.",
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
      {
        title: "Consultar a ajuda visual",
        description: "A aba Como funciona abre topicos com passo a passo, demonstracao visual e transicoes suaves.",
        steps: [
          "Clique no icone de ajuda no cabecalho do calendario.",
          "Abra Como funciona na lateral da pagina de ajuda.",
          "Escolha um topico para ver o exemplo visual e os passos daquele recurso.",
        ],
      },
      {
        title: "Ver atualizacoes por topico",
        description: "A aba Atualizacoes mostra cada novidade como um topico com passos e exemplo visual.",
        steps: [
          "Abra a pagina de ajuda pelo icone de ajuda.",
          "Clique em Atualizacoes para expandir a versao desejada.",
          "Escolha um topico da versao para ver o resumo, o passo a passo e o exemplo visual.",
        ],
      },
      {
        title: "Acompanhar notificacoes por status",
        description: "A pagina de notificacoes usa cores para diferenciar lidas, nao lidas, pendentes, aceitas e rejeitadas.",
        steps: [
          "Abra a pagina de notificacoes pelo sino.",
          "Use os cards do topo para ver pendencias e avisos nao lidos.",
          "Confira as badges: verde para lida/aceita, amarelo para pendente e vermelho para nao lida/rejeitada.",
        ],
      },
      {
        title: "Ver detalhes de uma notificacao",
        description: "Cada aviso pode abrir uma ficha com contexto da reuniao ou da solicitacao sem sair da agenda.",
        steps: [
          "Abra o sino ou a pagina de notificacoes.",
          "Clique em Ver detalhes na notificacao desejada.",
          "Confira titulo, sala, horario, quem agendou, convidados e, quando existir, a sugestao de remarcacao.",
        ],
      },
      {
        title: "Receber notificacoes de agendamento",
        description: "Confirmacoes, convites, remarcacoes, cancelamentos e lembretes tambem aparecem dentro do sistema.",
        steps: [
          "Abra o sino ou a pagina de notificacoes.",
          "Clique em Abrir Teams quando a sala tiver link do Teams configurado.",
          "Se a sala nao tiver link do Teams, a notificacao aparece sem botao externo.",
        ],
      },
      {
        title: "Usar o menu lateral no mobile",
        description: "Em telas compactas, a lista de salas abre como painel sobre a agenda e fecha automaticamente.",
        steps: [
          "Clique no botao de menu no cabecalho do calendario.",
          "Escolha uma sala para carregar a agenda.",
          "O painel fecha sozinho; para cancelar, toque fora do menu.",
        ],
      },
    ],
  },
];

export const LATEST_RELEASE_NOTE = RELEASE_NOTES[0];
