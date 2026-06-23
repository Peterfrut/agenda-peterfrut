"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  Bell,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Edit3,
  MailPlus,
  Moon,
  PanelsTopLeft,
  PlusCircle,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { RELEASE_NOTES } from "@/lib/release-notes";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import styles from "./patch-notes.module.css";

type HelpTab = "updates" | "guide";
type ExpandedHelpTab = HelpTab | null;

type HelpVisualKind =
  | "room-select"
  | "calendar"
  | "create"
  | "personal"
  | "edit"
  | "reschedule"
  | "guests"
  | "participant"
  | "notifications"
  | "theme";

type HelpSection = {
  title: string;
  description: string;
  steps: string[];
  visual: HelpVisualKind;
  icon: LucideIcon;
  accent: string;
};

const HOW_TO_SECTIONS: HelpSection[] = [
  {
    title: "Entrar e escolher uma sala",
    description: "Ao acessar a agenda, escolha uma sala na tela inicial. Depois, a troca de sala fica na barra lateral.",
    visual: "room-select",
    icon: PanelsTopLeft,
    accent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    steps: [
      "Faça login normalmente.",
      "Na tela de seleção, clique na sala desejada ou em Agenda Pessoal.",
      "Para trocar depois, use a lista de salas na barra lateral.",
    ],
  },
  {
    title: "Visualizar calendário e horários do dia",
    description: "O centro mostra o calendário e o painel lateral mostra os horários agendados do dia selecionado.",
    visual: "calendar",
    icon: CalendarDays,
    accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    steps: [
      "Escolha a sala.",
      "Use Hoje, Mês, Semana ou Dia para navegar.",
      "Clique em um agendamento para ver os detalhes.",
    ],
  },
  {
    title: "Criar um agendamento",
    description: "Use o botão Criar agendamento ou clique em um espaço livre do calendário.",
    visual: "create",
    icon: PlusCircle,
    accent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
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
    visual: "personal",
    icon: CalendarCheck2,
    accent: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    steps: [
      "Selecione Agenda Pessoal na tela inicial ou na barra lateral.",
      "Confira seus compromissos do dia.",
      "O sistema bloqueia conflito entre sua agenda pessoal e reservas de sala.",
    ],
  },
  {
    title: "Editar agendamento",
    description: "Responsável e admin podem editar título, justificativa e convidados.",
    visual: "edit",
    icon: Edit3,
    accent: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
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
    visual: "reschedule",
    icon: ArrowRightLeft,
    accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    steps: [
      "Abra o detalhe ou use o painel Horários Agendados.",
      "Clique em Reagendar para alterar data/horário.",
      "Clique em Cancelar para excluir a reserva e enviar aviso de cancelamento.",
    ],
  },
  {
    title: "Adicionar convidados",
    description: "O campo de convidados busca usuários cadastrados e também aceita e-mails externos.",
    visual: "guests",
    icon: MailPlus,
    accent: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
    steps: [
      "Digite pelo menos duas letras do nome ou e-mail.",
      "Selecione uma sugestão ou digite um e-mail completo.",
      "Clique em adicionar e salve o agendamento.",
    ],
  },
  {
    title: "Ações do convidado",
    description: "Convidado não altera a reunião diretamente; ele pode avisar ausência ou sugerir remarcação.",
    visual: "participant",
    icon: UserCheck,
    accent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    steps: [
      "Abra o detalhe da reserva em que você é convidado.",
      "Use Não vou comparecer para sair da reserva e avisar o responsável.",
      "Use Solicitar remarcação para enviar uma sugestão sem mudar o horário da reunião.",
    ],
  },
  {
    title: "Notificações",
    description: "O sino mostra notificações recentes sem bloquear a tela.",
    visual: "notifications",
    icon: Bell,
    accent: "bg-red-500/10 text-red-700 dark:text-red-300",
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
    visual: "theme",
    icon: Moon,
    accent: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    steps: [
      "Clique no ícone de tema no perfil.",
      "Escolha o modo que preferir.",
      "A agenda, cards, pop-ups e menus acompanham o tema selecionado.",
    ],
  },
];

type ReleaseNote = (typeof RELEASE_NOTES)[number];
type ReleaseExample = ReleaseNote["examples"][number];

const UPDATE_VISUAL_RULES: Array<{
  keywords: string[];
  visual: HelpVisualKind;
  icon: LucideIcon;
  accent: string;
}> = [
  {
    keywords: ["editar", "edicao", "alterar"],
    visual: "edit",
    icon: Edit3,
    accent: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    keywords: ["convidado", "externo", "usuario", "nome", "email"],
    visual: "guests",
    icon: MailPlus,
    accent: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  {
    keywords: ["justificar", "justificativa", "longa", "recorrencia"],
    visual: "create",
    icon: PlusCircle,
    accent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  {
    keywords: ["nao vai comparecer", "ausencia", "participar"],
    visual: "participant",
    icon: UserCheck,
    accent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  {
    keywords: ["remarcacao", "reagendar", "remarcar"],
    visual: "reschedule",
    icon: ArrowRightLeft,
    accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    keywords: ["notificacao", "notificacoes", "sino"],
    visual: "notifications",
    icon: Bell,
    accent: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
  {
    keywords: ["sala", "entrar", "selecionar"],
    visual: "room-select",
    icon: PanelsTopLeft,
    accent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    keywords: ["ajuda", "visual", "topico"],
    visual: "calendar",
    icon: BookOpen,
    accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getUpdateTopic(example: ReleaseExample): HelpSection {
  const searchable = normalizeText(`${example.title} ${example.description} ${example.steps.join(" ")}`);
  const rule = UPDATE_VISUAL_RULES.find((item) =>
    item.keywords.some((keyword) => searchable.includes(normalizeText(keyword)))
  );

  return {
    title: example.title,
    description: example.description,
    steps: example.steps,
    visual: rule?.visual ?? "calendar",
    icon: rule?.icon ?? Sparkles,
    accent: rule?.accent ?? "bg-primary/10 text-primary",
  };
}

export default function PatchNotesPage() {
  const [expandedTab, setExpandedTab] = useState<ExpandedHelpTab>(null);
  const [contentTab, setContentTab] = useState<HelpTab>("guide");
  const [activeReleaseIndex, setActiveReleaseIndex] = useState(0);
  const [activeUpdateTopicIndex, setActiveUpdateTopicIndex] = useState(0);
  const [activeGuideIndex, setActiveGuideIndex] = useState(0);
  const activeRelease = RELEASE_NOTES[activeReleaseIndex] ?? RELEASE_NOTES[0];
  const activeUpdateTopics = activeRelease.examples.map(getUpdateTopic);
  const activeUpdateTopic = activeUpdateTopics[activeUpdateTopicIndex] ?? activeUpdateTopics[0];
  const activeGuide = HOW_TO_SECTIONS[activeGuideIndex];
  const ActiveUpdateIcon = activeUpdateTopic?.icon ?? Sparkles;
  const ActiveGuideIcon = activeGuide.icon;

  function toggleUpdates() {
    setExpandedTab((current) => (current === "updates" ? null : "updates"));
  }

  function toggleGuide() {
    setExpandedTab((current) => (current === "guide" ? null : "guide"));
  }

  function selectUpdateRelease(releaseIndex: number) {
    const nextReleaseIndex = Math.min(releaseIndex, RELEASE_NOTES.length - 1);

    setExpandedTab("updates");
    setActiveReleaseIndex(nextReleaseIndex);
    setActiveUpdateTopicIndex(0);
  }

  function selectUpdateTopic(releaseIndex = activeReleaseIndex, topicIndex = activeUpdateTopicIndex) {
    const nextReleaseIndex = Math.min(releaseIndex, RELEASE_NOTES.length - 1);
    const nextRelease = RELEASE_NOTES[nextReleaseIndex] ?? RELEASE_NOTES[0];
    const nextTopicIndex = Math.min(topicIndex, Math.max(nextRelease.examples.length - 1, 0));

    setExpandedTab("updates");
    setContentTab("updates");
    setActiveReleaseIndex(nextReleaseIndex);
    setActiveUpdateTopicIndex(nextTopicIndex);
  }

  function selectGuideTopic(index = activeGuideIndex) {
    setExpandedTab("guide");
    setContentTab("guide");
    setActiveGuideIndex(index);
  }

  return (
    <main className={`min-h-screen bg-background px-4 py-6 ${styles.pageEnter}`}>
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
                Consulte novidades do sistema ou escolha um tópico para ver o passo a passo com exemplo visual.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/">Voltar para agenda</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Card className={`p-2 ${styles.sidebarCard}`}>
              <button
                type="button"
                onClick={toggleUpdates}
                className={`${styles.navItem} flex w-full items-start gap-3 rounded-md px-3 py-3 text-left text-sm transition ${
                  expandedTab === "updates" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 font-semibold">
                    Atualizações
                    <ChevronDown
                      className={`h-4 w-4 transition ${expandedTab === "updates" ? "rotate-180" : ""}`}
                    />
                  </span>
                  <span className={`block text-xs ${expandedTab === "updates" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    Versões, tópicos e exemplos visuais.
                  </span>
                </span>
              </button>

              <div className={`grid transition-[grid-template-rows] duration-200 ${expandedTab === "updates" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="mt-2 space-y-3 border-l pl-2">
                    {RELEASE_NOTES.map((note, releaseIndex) => (
                      <div key={note.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => selectUpdateRelease(releaseIndex)}
                          className={`${styles.navItem} flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                            activeReleaseIndex === releaseIndex
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">Versão {note.version}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {new Date(note.publishedAt).toLocaleDateString("pt-BR")}
                            </span>
                          </span>
                        </button>

                        {activeReleaseIndex === releaseIndex && (
                          <div className="space-y-1 pl-2">
                            {note.examples.map((example, topicIndex) => {
                              const topic = getUpdateTopic(example);
                              const Icon = topic.icon;
                              const selected = contentTab === "updates" && activeReleaseIndex === releaseIndex && activeUpdateTopicIndex === topicIndex;

                              return (
                                <button
                                  key={example.title}
                                  type="button"
                                  onClick={() => selectUpdateTopic(releaseIndex, topicIndex)}
                                  className={`${styles.navItem} flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                                    selected
                                      ? "bg-muted font-medium text-foreground"
                                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                  }`}
                                >
                                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${topic.accent}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="line-clamp-2">{topic.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleGuide}
                className={`${styles.navItem} mt-1 flex w-full items-start gap-3 rounded-md px-3 py-3 text-left text-sm transition ${
                  expandedTab === "guide" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 font-semibold">
                    Como funciona
                    <ChevronDown
                      className={`h-4 w-4 transition ${expandedTab === "guide" ? "rotate-180" : ""}`}
                    />
                  </span>
                  <span className={`block text-xs ${expandedTab === "guide" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    Abra os tópicos e veja exemplos visuais.
                  </span>
                </span>
              </button>

              <div className={`grid transition-[grid-template-rows] duration-200 ${expandedTab === "guide" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="mt-2 space-y-1 border-l pl-2">
                    {HOW_TO_SECTIONS.map((section, index) => {
                      const Icon = section.icon;
                      const selected = contentTab === "guide" && activeGuideIndex === index;

                      return (
                        <button
                          key={section.title}
                          type="button"
                          onClick={() => selectGuideTopic(index)}
                          className={`${styles.navItem} flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                            selected ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                          }`}
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${section.accent}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="line-clamp-2">{section.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          </aside>

          <section className="min-w-0">
            {contentTab === "updates" ? (
              <div
                key={`updates-${activeReleaseIndex}-${activeUpdateTopicIndex}`}
                className={`rounded-lg border bg-card shadow-sm ${styles.contentPanel}`}
              >
                <div className="border-b p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-primary">Atualizações</p>
                      <h2 className="text-2xl font-bold tracking-tight">{activeRelease.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Versão {activeRelease.version}</p>
                    </div>
                    <time className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground" dateTime={activeRelease.publishedAt}>
                      {new Date(activeRelease.publishedAt).toLocaleDateString("pt-BR")}
                    </time>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="p-5">
                    {activeUpdateTopic ? (
                      <>
                        <div className={`flex items-start gap-3 ${styles.topicHeader}`}>
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${activeUpdateTopic.accent}`}>
                            <ActiveUpdateIcon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-primary">Tópico da atualização</p>
                            <h3 className="text-2xl font-bold tracking-tight">{activeUpdateTopic.title}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">{activeUpdateTopic.description}</p>
                          </div>
                        </div>

                        <div className="mt-6">
                          <h4 className="text-sm font-semibold uppercase text-muted-foreground">Como usar na prática</h4>
                          <ol className="mt-3 space-y-3">
                            {activeUpdateTopic.steps.map((step, index) => (
                              <li key={step} className={`flex gap-3 rounded-md border bg-background p-3 text-sm ${styles.stepItem}`}>
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                  {index + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Esta versão ainda não possui exemplos cadastrados.</p>
                    )}

                    <div className="mt-6">
                      <h4 className="text-sm font-semibold uppercase text-muted-foreground">Resumo da versão</h4>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {activeRelease.items.map((item) => (
                          <div key={item} className={`flex gap-2 rounded-md border bg-background px-3 py-2 text-sm ${styles.summaryItem}`}>
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t bg-muted/25 p-4 lg:border-l lg:border-t-0">
                    <p className="mb-3 text-sm font-semibold text-muted-foreground">Exemplo visual</p>
                    {activeUpdateTopic ? (
                      <HelpVisual key={`${activeUpdateTopic.title}-${activeUpdateTopic.visual}`} kind={activeUpdateTopic.visual} />
                    ) : (
                      <VisualFrame>
                        <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                          Adicione exemplos na versão para exibir demonstrações visuais.
                        </div>
                      </VisualFrame>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div key={`guide-${activeGuideIndex}`} className={`rounded-lg border bg-card shadow-sm ${styles.contentPanel}`}>
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="p-5">
                    <div className={`flex items-start gap-3 ${styles.topicHeader}`}>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${activeGuide.accent}`}>
                        <ActiveGuideIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-primary">Como funciona</p>
                        <h2 className="text-2xl font-bold tracking-tight">{activeGuide.title}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{activeGuide.description}</p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-sm font-semibold uppercase text-muted-foreground">Passo a passo</h3>
                      <ol className="mt-3 space-y-3">
                        {activeGuide.steps.map((step, index) => (
                          <li key={step} className={`flex gap-3 rounded-md border bg-background p-3 text-sm ${styles.stepItem}`}>
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <div className="border-t bg-muted/25 p-4 lg:border-l lg:border-t-0">
                    <p className="mb-3 text-sm font-semibold text-muted-foreground">Exemplo visual</p>
                    <HelpVisual key={`${activeGuide.title}-${activeGuide.visual}`} kind={activeGuide.visual} />
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function HelpVisual({ kind }: { kind: HelpVisualKind }) {
  switch (kind) {
    case "room-select":
      return (
        <VisualFrame>
          <div className="space-y-3">
            <div className="mx-auto h-3 w-32 rounded-full bg-foreground/20" />
            <div className="grid grid-cols-2 gap-2">
              {["Auditório", "Sala Reunião", "Atendimento I", "Agenda Pessoal"].map((room, index) => (
                <div
                  key={room}
                  className={`rounded-md border px-3 py-2 text-xs font-medium ${
                    index === 1 ? "border-primary bg-primary/10 text-primary" : "bg-background"
                  }`}
                >
                  {room}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-background p-2">
              <div className="h-14 w-20 rounded-md bg-primary/15" />
              <div className="flex-1 space-y-2">
                <div className="h-2 w-24 rounded-full bg-foreground/20" />
                <div className="h-2 w-32 rounded-full bg-foreground/10" />
              </div>
            </div>
          </div>
        </VisualFrame>
      );

    case "calendar":
      return (
        <VisualFrame>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-md bg-primary/15" />
              <div className="flex rounded-md border bg-background p-1 text-[10px]">
                <span className="rounded bg-primary px-2 py-1 text-primary-foreground">Mês</span>
                <span className="px-2 py-1 text-muted-foreground">Semana</span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 28 }).map((_, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded border ${
                    [9, 10, 16].includes(index) ? "bg-primary/20" : "bg-background"
                  }`}
                />
              ))}
            </div>
            <div className="grid gap-2">
              <div className="rounded-md border-l-4 border-l-primary bg-background p-2 text-xs">09:00 Reunião comercial</div>
              <div className="rounded-md border-l-4 border-l-emerald-500 bg-background p-2 text-xs">14:00 Alinhamento</div>
            </div>
          </div>
        </VisualFrame>
      );

    case "create":
      return (
        <VisualFrame>
          <div className="space-y-2">
            <div className="rounded-md border bg-background p-3">
              <div className="mb-2 h-2 w-20 rounded-full bg-foreground/20" />
              <div className="h-8 rounded-md border bg-muted/40" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-background p-2 text-xs">08:00</div>
              <div className="rounded-md border bg-background p-2 text-xs">11:30</div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="mb-2 flex gap-1">
                <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] text-primary">maria@empresa</span>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px]">externo@email</span>
              </div>
              <div className="h-14 rounded-md border border-dashed bg-amber-500/10 p-2 text-[10px] text-amber-700 dark:text-amber-300">
                Justificativa para reserva longa
              </div>
            </div>
            <div className="rounded-md bg-primary py-2 text-center text-xs font-semibold text-primary-foreground">Reservar</div>
          </div>
        </VisualFrame>
      );

    case "personal":
      return (
        <VisualFrame>
          <div className="space-y-3">
            <div className="rounded-md border bg-background p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <CalendarCheck2 className="h-4 w-4 text-primary" />
                Agenda Pessoal
              </div>
              <div className="space-y-2">
                <div className="rounded-md bg-primary/10 p-2 text-xs">06:00 - 13:00 Visita técnica</div>
                <div className="rounded-md border border-red-300 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
                  Conflito bloqueado: 06:00 - 06:30
                </div>
              </div>
            </div>
          </div>
        </VisualFrame>
      );

    case "edit":
      return (
        <VisualFrame>
          <div className="space-y-3">
            <div className="rounded-md border bg-background p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold">Editar reserva</span>
                <Edit3 className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="h-8 rounded-md border bg-muted/40 px-2 py-2 text-xs">Reunião semanal</div>
                <div className="rounded-md border bg-muted/40 p-2 text-xs">Justificativa atualizada</div>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] text-primary">joao@empresa</span>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px]">ana@empresa</span>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-primary py-2 text-center text-xs font-semibold text-primary-foreground">Salvar alterações</div>
          </div>
        </VisualFrame>
      );

    case "reschedule":
      return (
        <VisualFrame>
          <div className="space-y-3">
            <div className="rounded-md border bg-background p-3 text-xs">
              <p className="font-semibold">Solicitação recebida</p>
              <p className="mt-1 text-muted-foreground">Sugestão: amanhã às 10:00</p>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-medium">
              <div className="rounded-md border bg-background py-2">Reagendar</div>
              <div className="rounded-md border bg-background py-2">Manter horário</div>
            </div>
          </div>
        </VisualFrame>
      );

    case "guests":
      return (
        <VisualFrame>
          <div className="space-y-3">
            <div className="rounded-md border bg-background p-3">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">Pesquisar por nome ou e-mail...</div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between rounded-md bg-primary/10 px-2 py-2 text-xs">
                  <span>Maria Oliveira</span>
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex items-center justify-between rounded-md bg-background px-2 py-2 text-xs">
                  <span>marcos@empresa.com</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="rounded-md border border-dashed bg-background p-2 text-xs">cliente@externo.com</div>
          </div>
        </VisualFrame>
      );

    case "participant":
      return (
        <VisualFrame>
          <div className="space-y-3">
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold">Detalhes da reunião</p>
              <div className="mt-3 space-y-2">
                <div className="rounded-md bg-muted p-2 text-xs">Você está como convidado</div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="rounded-md border bg-background py-2 text-center text-xs">Solicitar remarcação</div>
                  <div className="rounded-md border bg-background py-2 text-center text-xs">Não vou comparecer</div>
                </div>
              </div>
            </div>
          </div>
        </VisualFrame>
      );

    case "notifications":
      return (
        <VisualFrame>
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="relative rounded-md border bg-background p-2">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[10px] text-white">2</span>
              </div>
            </div>
            <div className="rounded-md border bg-background p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span>Notificações</span>
                <span className="text-primary">Lidas</span>
              </div>
              <div className="space-y-2">
                <div className="rounded-md border p-2 text-xs">Solicitação de remarcação</div>
                <div className="rounded-md border p-2 text-xs">Nova atualização disponível</div>
              </div>
            </div>
          </div>
        </VisualFrame>
      );

    case "theme":
      return (
        <VisualFrame>
          <div className="grid grid-cols-2 overflow-hidden rounded-md border">
            <div className="space-y-3 bg-white p-4 text-slate-900">
              <div className="h-3 w-16 rounded-full bg-slate-300" />
              <div className="rounded-md border border-slate-200 p-2 text-xs">Claro</div>
              <div className="grid grid-cols-3 gap-1">
                <div className="h-8 rounded bg-blue-100" />
                <div className="h-8 rounded bg-emerald-100" />
                <div className="h-8 rounded bg-slate-100" />
              </div>
            </div>
            <div className="space-y-3 bg-slate-950 p-4 text-white">
              <div className="h-3 w-16 rounded-full bg-slate-700" />
              <div className="rounded-md border border-slate-700 p-2 text-xs">Escuro</div>
              <div className="grid grid-cols-3 gap-1">
                <div className="h-8 rounded bg-blue-900" />
                <div className="h-8 rounded bg-emerald-900" />
                <div className="h-8 rounded bg-slate-800" />
              </div>
            </div>
          </div>
        </VisualFrame>
      );
  }
}

function VisualFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border bg-background p-3 shadow-sm ${styles.visualFrame}`}>
      <div className="mb-3 flex items-center gap-1.5 border-b pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 h-2 w-20 rounded-full bg-muted-foreground/20" />
      </div>
      {children}
    </div>
  );
}
