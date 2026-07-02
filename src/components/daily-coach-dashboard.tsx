"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  FileWarning,
  MessageCircle,
  Phone,
  Radar,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { buildDailyCoach, type DailyCoachPlan } from "@/lib/coach/daily-coach";
import { getSoniaProspects, type SoniaHistoryEvent, type SoniaProspect } from "@/lib/sonia-beta";

type CoachMessage = {
  id: string;
  text: string;
  createdAt: string;
  tone: "intro" | "reaction" | "next-step" | "win";
  actionLabel?: string;
  actionHref?: string;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const conversationKey = () => `iacourtier_coach_conversation_${todayKey()}`;

export function DailyCoachDashboard() {
  const [prospects, setProspects] = useState<SoniaProspect[]>([]);
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  const coach = useMemo(() => buildDailyCoach(prospects, "Sonia"), [prospects]);

  const refreshCoach = useCallback(() => {
    const freshProspects = getSoniaProspects();
    setProspects(freshProspects);
  }, []);

  useEffect(() => {
    refreshCoach();
  }, [refreshCoach]);

  useEffect(() => {
    setMessages(loadConversation());
  }, []);

  useEffect(() => {
    setMessages((current) => {
      const merged = mergeMessages(current, buildConversationMessages(coach, prospects));
      saveConversation(merged);
      return merged;
    });
  }, [coach, prospects]);

  const visibleMessages = messages.slice(-8);

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-subtle bg-surface-soft p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-electric-500">{coach.greeting}</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Ton Coach IA est avec toi pour faire avancer la journée.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{coach.coachLine}</p>
          </div>
          <button
            type="button"
            onClick={refreshCoach}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-subtle bg-surface px-4 py-3 text-sm font-semibold hover:border-electric-500/40"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser le Coach
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <CoachConversation messages={visibleMessages} fallbackAction={coach.firstAction} />
        <NextStepCard coach={coach} />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Phone} label="Appels a faire" value={coach.objective.callsToMake} />
        <Metric icon={Radar} label="Prospects Radar" value={coach.objective.radarProspects} />
        <Metric icon={RefreshCw} label="Relances dues" value={coach.objective.followupsDue} />
        <Metric icon={CalendarCheck} label="Rendez-vous a preparer" value={coach.objective.sellerAppointments} />
        <Metric icon={BarChart3} label="Analyses de marche" value={coach.objective.marketAnalyses} />
        <Metric icon={FileWarning} label="Documents manquants" value={coach.objective.missingDocuments} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-subtle bg-surface p-5">
          <p className="text-sm font-semibold text-electric-500">Plan de bataille</p>
          <div className="mt-5 space-y-3">
            <PlanRow title="1. Appeler les prospects Radar" items={coach.battlePlan.radarProspectsToCall} empty="Aucun prospect Radar a appeler." />
            <PlanRow title="2. Faire les relances dues" items={coach.battlePlan.followupsDue} empty="Aucune relance due." />
            <PlanRow title="3. Preparer les rendez-vous vendeurs" items={coach.battlePlan.sellerAppointmentsToPrepare} empty="Aucun rendez-vous vendeur a preparer." />
            <PlanRow title="4. Finaliser les analyses de marche" items={coach.battlePlan.marketAnalysesToPrepare} empty="Aucune analyse a finaliser." />
            <PlanRow title="5. Documents vendeur manquants" items={coach.battlePlan.mandatesWithMissingDocuments} empty="Aucun document urgent." />
          </div>
        </section>

        <aside className="rounded-2xl border border-subtle bg-surface p-5">
          <p className="text-sm font-semibold text-electric-500">Ce que je te recommande</p>
          <div className="mt-4 space-y-3">
            {coach.recommendations.map((item) => (
              <div key={item} className="rounded-2xl border border-subtle bg-surface-soft p-4 text-sm leading-6">
                {item}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CoachConversation({
  messages,
  fallbackAction,
}: {
  messages: CoachMessage[];
  fallbackAction: DailyCoachPlan["firstAction"];
}) {
  return (
    <section className="rounded-2xl border border-subtle bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-electric-500">
          <MessageCircle className="h-4 w-4" />
          Conversation du Coach
        </p>
        <span className="rounded-full border border-subtle bg-surface-soft px-3 py-1 text-xs font-semibold text-muted">Aujourd&apos;hui</span>
      </div>

      <div className="mt-5 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="rounded-2xl border border-subtle bg-surface-soft p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-electric-500/10 p-2 text-electric-500">
                {message.tone === "win" ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Coach IA</p>
                <p className="mt-2 text-sm leading-6 text-muted">{message.text}</p>
                {message.actionHref && message.actionLabel ? (
                  <Link
                    href={message.actionHref}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                  >
                    {message.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Link
        href={fallbackAction.href}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-subtle bg-background px-5 py-3 text-sm font-semibold hover:border-electric-500/40"
      >
        Continuer avec la prochaine action
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function NextStepCard({ coach }: { coach: DailyCoachPlan }) {
  return (
    <aside className="rounded-2xl border border-subtle bg-slate-950 p-5 text-white dark:bg-white dark:text-slate-950">
      <p className="flex items-center gap-2 text-sm font-semibold text-white/75 dark:text-slate-600">
        <Sparkles className="h-4 w-4" />
        Prochaine meilleure action
      </p>
      <h2 className="mt-4 text-2xl font-semibold leading-tight">{coach.firstAction.label}</h2>
      <p className="mt-3 text-sm leading-6 text-white/70 dark:text-slate-600">{coach.firstAction.description}</p>
      <Link
        href={coach.firstAction.href}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 dark:bg-slate-950 dark:text-white"
      >
        Commencer maintenant
        <ArrowRight className="h-4 w-4" />
      </Link>
      <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm leading-6 text-white/75 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-600">
        {coach.focus}
      </div>
    </aside>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-subtle bg-surface p-4">
      <Icon className="h-4 w-4 text-electric-500" />
      <p className="mt-4 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{label}</p>
    </div>
  );
}

function PlanRow({ title, items, empty }: { title: string; items: SoniaProspect[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-subtle bg-surface-soft p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={`/tableau-de-bord/prospects/${item.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-surface px-3 py-2 text-sm hover:border-electric-500/40"
            >
              <span>
                <span className="font-semibold">{item.name}</span>
                <span className="ml-2 text-muted">{item.city}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted" />
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted">{empty}</p>
        )}
      </div>
    </div>
  );
}

function buildConversationMessages(coach: DailyCoachPlan, prospects: SoniaProspect[]): CoachMessage[] {
  const now = new Date().toISOString();
  const messages: CoachMessage[] = [
    {
      id: `intro-${todayKey()}`,
      text: coach.hasRealData
        ? "Salut Sonia. Je garde le fil de ta journee ici. Chaque prospect cree, appel lance, resultat note ou rendez-vous obtenu devient la prochaine etape."
        : "Sonia, on part de zero, et c'est parfait. Ta premiere mission est simple : debloquer tes premiers prospects Radar et faire tes appels.",
      createdAt: now,
      tone: "intro",
      actionLabel: coach.firstAction.label,
      actionHref: coach.firstAction.href,
    },
  ];

  if (!coach.hasRealData) {
    messages.push({
      id: `beta-start-${todayKey()}`,
      text: "Ne commence pas par gosser dans tes textes. Aujourd'hui, ton argent est dans les appels. Je te guide : prospect, appel, resultat, relance, rendez-vous.",
      createdAt: now,
      tone: "next-step",
      actionLabel: "Commencer ma prospection",
      actionHref: "/tableau-de-bord/radar-prospection",
    });
    return messages;
  }

  const realProspects = prospects
    .filter((prospect) => !prospect.id.startsWith("sonia-demo-"))
    .flatMap((prospect) =>
      prospect.history.map((event) => ({
        prospect,
        event,
      })),
    )
    .sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime());

  realProspects.forEach(({ prospect, event }) => {
    const reaction = reactionForEvent(prospect, event);
    if (reaction) messages.push(reaction);
  });

  messages.push({
    id: `next-${todayKey()}-${coach.firstAction.href}`,
    text: `La prochaine action utile maintenant : ${coach.firstAction.description}`,
    createdAt: now,
    tone: "next-step",
    actionLabel: coach.firstAction.label,
    actionHref: coach.firstAction.href,
  });

  return messages;
}

function reactionForEvent(prospect: SoniaProspect, event: SoniaHistoryEvent): CoachMessage | null {
  const title = event.title.toLowerCase();
  const description = event.description.toLowerCase();
  const base = {
    id: `history-${prospect.id}-${event.id}`,
    createdAt: event.date,
  };

  if (title.includes("prospect") && title.includes("radar")) {
    return {
      ...base,
      tone: "reaction",
      text: `Parfait. ${prospect.name} est maintenant dans ton plan. Prochaine etape : l'appel. Si ca ne repond pas, je te prepare le texto et la relance.`,
      actionLabel: "Appeler ce prospect",
      actionHref: `/tableau-de-bord/prospects/${prospect.id}?demoCall=1`,
    };
  }

  if (title.includes("appel") && (title.includes("lance") || title.includes("démo") || title.includes("demo"))) {
    return {
      ...base,
      tone: "reaction",
      text: `Bon. L'appel avec ${prospect.name} est lance. Apres l'appel, note le resultat tout de suite. C'est la que le suivi se gagne.`,
      actionLabel: "Noter le resultat",
      actionHref: `/tableau-de-bord/prospects/${prospect.id}`,
    };
  }

  if (title.includes("resultat") || title.includes("résultat")) {
    if (description.includes("rendez-vous")) {
      return {
        ...base,
        tone: "win",
        text: `Excellent. Rendez-vous vendeur obtenu avec ${prospect.name}. Maintenant, on prepare l'analyse de marche avant la rencontre. Pas apres le mandat.`,
        actionLabel: "Preparer l'analyse",
        actionHref: `/tableau-de-bord/actions/prepare-market-analysis?name=${encodeURIComponent(prospect.name)}&address=${encodeURIComponent(prospect.address)}&city=${encodeURIComponent(prospect.city)}&context=prospect`,
      };
    }

    if (description.includes("interesse") || description.includes("intéressé")) {
      return {
        ...base,
        tone: "reaction",
        text: `${prospect.name} montre de l'ouverture. Reste simple : une bonne question de decouverte, puis une proposition de rendez-vous clair.`,
        actionLabel: "Preparer le prochain contact",
        actionHref: `/tableau-de-bord/actions/prepare-first-seller-call?name=${encodeURIComponent(prospect.name)}&address=${encodeURIComponent(prospect.address)}&city=${encodeURIComponent(prospect.city)}&context=prospect`,
      };
    }

    if (description.includes("aucune reponse") || description.includes("pas repondu") || description.includes("pas répondu")) {
      return {
        ...base,
        tone: "reaction",
        text: `Pas de reponse avec ${prospect.name}. On ne dramatise pas : texto court, relance dans 2 jours, puis on continue le plan.`,
        actionLabel: "Voir la relance",
        actionHref: `/tableau-de-bord/prospects/${prospect.id}`,
      };
    }

    return {
      ...base,
      tone: "reaction",
      text: `Resultat note pour ${prospect.name}. Je mets la prochaine action au clair : ${prospect.nextAction}.`,
      actionLabel: "Continuer la fiche",
      actionHref: `/tableau-de-bord/prospects/${prospect.id}`,
    };
  }

  if (title.includes("actions") && description.includes("analyse de marche")) {
    return {
      ...base,
      tone: "next-step",
      text: `La, tu as un rendez-vous a preparer. On fait l'analyse de marche, les questions vendeur et les arguments avant d'entrer dans la rencontre.`,
      actionLabel: "Preparer le rendez-vous",
      actionHref: `/tableau-de-bord/actions/prepare-market-analysis?name=${encodeURIComponent(prospect.name)}&address=${encodeURIComponent(prospect.address)}&city=${encodeURIComponent(prospect.city)}&context=prospect`,
    };
  }

  if (description.includes("documents vendeur") || description.includes("mise en marche")) {
    return {
      ...base,
      tone: "win",
      text: `Mandat signe. Beau travail. Maintenant le focus change : documents vendeur, description et mise en marche. On avance proprement.`,
      actionLabel: "Voir la fiche",
      actionHref: `/tableau-de-bord/prospects/${prospect.id}`,
    };
  }

  return null;
}

function loadConversation(): CoachMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(conversationKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CoachMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversation(messages: CoachMessage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(conversationKey(), JSON.stringify(messages.slice(-30)));
}

function mergeMessages(current: CoachMessage[], incoming: CoachMessage[]) {
  const byId = new Map<string, CoachMessage>();
  [...current, ...incoming].forEach((message) => byId.set(message.id, message));

  return Array.from(byId.values())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-30);
}
