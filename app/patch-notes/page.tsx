"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Clock3, Sparkles } from "lucide-react";
import { RELEASE_NOTES } from "@/lib/release-notes";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";

type HelpTab = "updates" | "guide";

const HOW_TO_SECTIONS = [
  {
    title: "Entrar e escolher uma sala",
    description: "Ao acessar a agenda, escolha uma sala na tela inicial. Depois, a troca de sala fica na barra lateral.",
    steps: [
      "Faça login normalmente.",
      "Na tela de seleção, clique na sala desejada ou em Agenda Pessoal.",
      "Para trocar depois, use a lista de salas na barra lateral.",
    ],
  },
  {
    title: "Visualizar calendário e horários do dia",
    description: "O centro mostra o calendário e o painel lateral mostra os horários agendados do dia selecionado.",
    steps: [
      "Escolha a sala.",
      "Use Hoje, mês, semana ou dia para navegar.",
      "Clique em um agendamento para ver os detalhes.",
    ],
  },
  {
    title: "Criar um agendamento",
    description: "Use o botão Criar agendamento ou clique em um espaço livre do calendário.",
    steps: [
      "Selecione a sala e a data.",
      "Informe título, horário e convidados se houver.",
      "Se a reserva passar de 3 horas ou tiver recorrência alta, informe a justificativa.",
      "Clique em Reservar.",
    ],
  },
  {
    title: "Usar a Agenda Pessoal",
    description: "A Agenda Pessoal reúne compromissos em que você é responsável ou convidado.",
    steps: [
      "Selecione Agenda Pessoal na tela inicial ou na barra lateral.",
      "Confira seus compromissos do dia.",
      "O sistema bloqueia conflito entre sua agenda pessoal e reservas de sala.",
    ],
  },
  {
    title: "Editar agendamento",
    description: "Responsável e admin podem editar título, justificativa e convidados.",
    steps: [
      "Abra o detalhe do agendamento ou use o botão de editar no painel Horários Agendados.",
      "Confira o resumo da reserva que aparece no topo.",
      "Altere título, justificativa ou convidados.",
      "Salve para atualizar a agenda e notificar convidados quando necessário.",
    ],
  },
  {
    title: "Reagendar ou cancelar",
    description: "Responsável e admin podem remarcar ou cancelar reservas.",
    steps: [
      "Abra o detalhe ou use o painel Horários Agendados.",
      "Clique em Reagendar para alterar data/horário.",
      "Clique em Cancelar para excluir a reserva e enviar aviso de cancelamento.",
    ],
  },
  {
    title: "Adicionar convidados",
    description: "O campo de convidados busca usuários cadastrados e também aceita e-mails externos.",
    steps: [
      "Digite pelo menos duas letras do nome ou e-mail.",
      "Selecione uma sugestão ou digite um e-mail completo.",
      "Clique em adicionar e salve o agendamento.",
    ],
  },
  {
    title: "Ações do convidado",
    description: "Convidado não altera a reunião diretamente; ele pode avisar ausência ou sugerir remarcação.",
    steps: [
      "Abra o detalhe da reserva em que você é convidado.",
      "Use Não vou comparecer para sair da reserva e avisar o responsável.",
      "Use Solicitar remarcação para enviar uma sugestão sem mudar o horário da reunião.",
    ],
  },
  {
    title: "Notificações",
    description: "O sino mostra notificações recentes sem bloquear a tela.",
    steps: [
      "Clique no sino ao lado dos botões Dia, Semana e Mês no cabeçalho do calendário.",
      "Leia até 10 notificações recentes.",
      "Use Marcar como lida em uma notificação ou Marcar lidas para todas.",
      "Use Ver detalhes para abrir a página completa.",
    ],
  },
  {
    title: "Tema claro e escuro",
    description: "O botão de tema fica junto ao perfil e altera a aparência do sistema.",
    steps: [
      "Clique no ícone de tema no perfil.",
      "Escolha o modo que preferir.",
      "A agenda, cards, pop-ups e menus acompanham o tema selecionado.",
    ],
  },
];

export default function PatchNotesPage() {
  const [activeTab, setActiveTab] = useState<HelpTab>("updates");

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Central de ajuda
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Agenda de Salas</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Consulte novidades do sistema ou veja o passo a passo das principais funcionalidades.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/">Voltar para agenda</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Card className="p-2">
              <button
                type="button"
                onClick={() => setActiveTab("updates")}
                className={`flex w-full items-start gap-3 rounded-md px-3 py-3 text-left text-sm transition ${
                  activeTab === "updates" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block font-semibold">Atualizações</span>
                  <span className={`block text-xs ${activeTab === "updates" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    Versões, novidades e exemplos recentes.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("guide")}
                className={`mt-1 flex w-full items-start gap-3 rounded-md px-3 py-3 text-left text-sm transition ${
                  activeTab === "guide" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block font-semibold">Como funciona</span>
                  <span className={`block text-xs ${activeTab === "guide" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    Guia de uso completo do sistema.
                  </span>
                </span>
              </button>
            </Card>
          </aside>

          <section className="min-w-0">
            {activeTab === "updates" ? (
              <div className="space-y-4">
                {RELEASE_NOTES.map((note) => (
                  <Card key={note.id} className="p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{note.title}</h2>
                        <p className="text-sm text-muted-foreground">Versão {note.version}</p>
                      </div>
                      <time className="text-sm text-muted-foreground" dateTime={note.publishedAt}>
                        {new Date(note.publishedAt).toLocaleDateString("pt-BR")}
                      </time>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {note.items.map((item) => (
                        <div key={item} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-6">
                      <h3 className="text-base font-semibold">Exemplos desta atualização</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {note.examples.map((example) => (
                          <div key={example.title} className="rounded-md border p-3">
                            <p className="font-semibold">{example.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{example.description}</p>
                            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                              {example.steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {HOW_TO_SECTIONS.map((section) => (
                  <Card key={section.title} className="p-4">
                    <h2 className="font-semibold">{section.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                      {section.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
