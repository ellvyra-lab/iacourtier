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
  PhoneCall,
  Radar,
  RefreshCw,
  Send,
  SkipForward,
  Sparkles,
} from "lucide-react";

import { buildDailyCoach, type DailyCoachPlan } from "@/lib/coach/daily-coach";
import { manualProspects } from "@/lib/prospecting/manual-provider";
import {
  createSellerProspectFromRadar,
  getSoniaProspects,
  recordCallResult,
  type CallResult,
  type SoniaHistoryEvent,
  type SoniaProspect,
} from "@/lib/sonia-beta";

type CoachMessage = {
  id: string;
  text: string;
  createdAt: string;
  tone: "intro" | "reaction" | "next-step" | "win";
  actionLabel?: string;
  actionHref?: string;
};

type ProspectingMission = {
  active: boolean;
  title: string;
  prospectIds: string[];
  currentIndex: number;
  startedAt: string;
  lastFeedback?: string;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const conversationKey = () => `iacourtier_coach_conversation_${todayKey()}`;
const missionKey = () => `iacourtier_coach_mission_${todayKey()}`;

export function DailyCoachDashboard() {
  const [prospects, setProspects] = useState<SoniaProspect[]>([]);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [mission, setMission] = useState<ProspectingMission | null>(null);
  const [callProspectId, setCallProspectId] = useState<string | null>(null);
  const [callNote, setCallNote] = useState("");

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
    setMission(loadMission());
  }, []);

  useEffect(() => {
    setMessages((current) => {
      const merged = mergeMessages(current, buildConversationMessages(coach, prospects));
      saveConversation(merged);
      return merged;
    });
  }, [coach, prospects]);

  const visibleMessages = messages.slice(-8);
  const missionProspect = getMissionProspect(mission, prospects);

  const appendCoachMessage = useCallback((message: Omit<CoachMessage, "id" | "createdAt">) => {
    setMessages((current) => {
      const next = [
        ...current,
        {
          ...message,
          id: `coach-${Date.now()}`,
          createdAt: new Date().toISOString(),
        },
      ].slice(-30);
      saveConversation(next);
      return next;
    });
  }, []);

  const startProspectingMission = useCallback(() => {
    const storedProspects = getSoniaProspects().filter((prospect) => !prospect.id.startsWith("sonia-demo-"));
    const radarProspects = storedProspects.filter((prospect) => prospect.source === "Radar");
    const missionProspects = radarProspects.length
      ? radarProspects
      : manualProspects.slice(0, 5).map((opportunity) => createSellerProspectFromRadar(opportunity));

    const nextMission: ProspectingMission = {
      active: true,
      title: "Mission : Trouver un rendez-vous vendeur",
      prospectIds: missionProspects.map((prospect) => prospect.id),
      currentIndex: 0,
      startedAt: new Date().toISOString(),
    };

    saveMission(nextMission);
    setMission(nextMission);
    setProspects(getSoniaProspects());
    appendCoachMessage({
      tone: "next-step",
      text: "Mission lancee. Je te donne un prospect a la fois. Tu appelles, tu notes le resultat, puis on passe au prochain. L'objectif : obtenir un rendez-vous vendeur.",
      actionLabel: "Voir le prospect recommande",
    });
  }, [appendCoachMessage]);

  const startCall = useCallback(
    (prospect: SoniaProspect) => {
      setCallProspectId(prospect.id);
      appendCoachMessage({
        tone: "reaction",
        text: `Appel lance pour ${prospect.name}. Reste simple : une question ouverte, un ton humain, puis une proposition de rencontre si la porte s'ouvre.`,
      });

      if (typeof window !== "undefined" && prospect.phone) {
        window.location.href = `tel:${prospect.phone}`;
      }
    },
    [appendCoachMessage],
  );

  const saveCallOutcome = useCallback(
    (result: CallResult) => {
      if (!callProspectId) return;
      const updated = recordCallResult(callProspectId, result, callNote);
      if (!updated) return;

      const feedback = buildMissionFeedback(updated, result);
      const nextMission = advanceMission(mission, result);
      saveMission(nextMission);
      setMission(nextMission);
      setCallProspectId(null);
      setCallNote("");
      setProspects(getSoniaProspects());
      appendCoachMessage({
        tone: result === "rendez_vous_obtenu" ? "win" : "reaction",
        text: feedback,
        actionLabel: result === "rendez_vous_obtenu" ? "Preparer le rendez-vous" : "Continuer la mission",
        actionHref:
          result === "rendez_vous_obtenu"
            ? `/tableau-de-bord/actions/prepare-market-analysis?name=${encodeURIComponent(updated.name)}&address=${encodeURIComponent(updated.address)}&city=${encodeURIComponent(updated.city)}&context=prospect`
            : undefined,
      });
    },
    [appendCoachMessage, callNote, callProspectId, mission],
  );

  const skipProspect = useCallback(() => {
    const nextMission = {
      ...(mission || {
        active: true,
        title: "Mission : Trouver un rendez-vous vendeur",
        prospectIds: [],
        currentIndex: 0,
        startedAt: new Date().toISOString(),
      }),
      currentIndex: Math.min((mission?.currentIndex || 0) + 1, Math.max((mission?.prospectIds.length || 1) - 1, 0)),
    };
    saveMission(nextMission);
    setMission(nextMission);
    appendCoachMessage({
      tone: "next-step",
      text: "Correct. On passe au prochain prospect. Garde ton rythme : une conversation vaut mieux que dix hesitations.",
    });
  }, [appendCoachMessage, mission]);

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
        <CoachConversation messages={visibleMessages} fallbackAction={coach.firstAction} onStartMission={startProspectingMission} />
        <NextStepCard coach={coach} onStartMission={startProspectingMission} />
      </div>

      {mission?.active ? (
        <ProspectingMissionPanel
          mission={mission}
          prospect={missionProspect}
          callProspectId={callProspectId}
          callNote={callNote}
          onCallNoteChange={setCallNote}
          onStartCall={startCall}
          onSaveOutcome={saveCallOutcome}
          onSkipProspect={skipProspect}
        />
      ) : null}

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
  onStartMission,
}: {
  messages: CoachMessage[];
  fallbackAction: DailyCoachPlan["firstAction"];
  onStartMission: () => void;
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

      <button
        type="button"
        onClick={onStartMission}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-subtle bg-background px-5 py-3 text-sm font-semibold hover:border-electric-500/40"
      >
        {fallbackAction.href.includes("radar-prospection") ? "Commencer ma prospection" : "Lancer la mission Coach"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function NextStepCard({ coach, onStartMission }: { coach: DailyCoachPlan; onStartMission: () => void }) {
  return (
    <aside className="rounded-2xl border border-subtle bg-slate-950 p-5 text-white dark:bg-white dark:text-slate-950">
      <p className="flex items-center gap-2 text-sm font-semibold text-white/75 dark:text-slate-600">
        <Sparkles className="h-4 w-4" />
        Prochaine meilleure action
      </p>
      <h2 className="mt-4 text-2xl font-semibold leading-tight">{coach.firstAction.label}</h2>
      <p className="mt-3 text-sm leading-6 text-white/70 dark:text-slate-600">{coach.firstAction.description}</p>
      <button
        type="button"
        onClick={onStartMission}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 dark:bg-slate-950 dark:text-white"
      >
        Commencer ma prospection
        <ArrowRight className="h-4 w-4" />
      </button>
      <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm leading-6 text-white/75 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-600">
        {coach.focus}
      </div>
    </aside>
  );
}

function ProspectingMissionPanel({
  mission,
  prospect,
  callProspectId,
  callNote,
  onCallNoteChange,
  onStartCall,
  onSaveOutcome,
  onSkipProspect,
}: {
  mission: ProspectingMission;
  prospect: SoniaProspect | null;
  callProspectId: string | null;
  callNote: string;
  onCallNoteChange: (value: string) => void;
  onStartCall: (prospect: SoniaProspect) => void;
  onSaveOutcome: (result: CallResult) => void;
  onSkipProspect: () => void;
}) {
  if (!prospect) {
    return (
      <section className="rounded-2xl border border-subtle bg-surface p-6">
        <p className="text-sm font-semibold text-electric-500">{mission.title}</p>
        <h2 className="mt-2 text-2xl font-semibold">Mission terminee pour le moment.</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Tu as passe a travers les prospects disponibles. Retourne au Radar pour en debloquer d&apos;autres ou reviens plus tard.
        </p>
        <Link href="/tableau-de-bord/radar-prospection" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
          Ouvrir le Radar
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  const isCalling = callProspectId === prospect.id;
  const script = buildCallScript(prospect);

  return (
    <section className="rounded-2xl border border-electric-500/25 bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-electric-500">{mission.title}</p>
          <h2 className="mt-2 text-2xl font-semibold">Premier prospect recommande</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            On y va un prospect a la fois. Ton objectif n&apos;est pas de vendre au telephone : c&apos;est d&apos;ouvrir une conversation et d&apos;obtenir une rencontre.
          </p>
        </div>
        <div className="rounded-2xl border border-subtle bg-surface-soft px-4 py-3 text-sm font-semibold">
          {mission.currentIndex + 1} / {mission.prospectIds.length}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-subtle bg-surface-soft p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Prospect selectionne</p>
          <h3 className="mt-3 text-xl font-semibold">{prospect.name}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {prospect.address}
            <br />
            {prospect.city}
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-semibold">Priorite :</span> {extractNoteValue(prospect.notes, "Priorite") || "Elevee"}
            </p>
            <p>
              <span className="font-semibold">Pourquoi lui :</span> {extractNoteValue(prospect.notes, "Pourquoi ce prospect") || "Bonne opportunite de conversation vendeur."}
            </p>
            <p>
              <span className="font-semibold">Prochaine action :</span> {prospect.nextAction}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-subtle bg-surface-soft p-5">
            <p className="text-sm font-semibold text-electric-500">Quoi dire au telephone</p>
            <p className="mt-3 text-base leading-7">{script}</p>
            <p className="mt-4 text-sm leading-6 text-muted">
              Ne parle pas de Radar, de score ou de donnees. Tu es simplement une courtiere active dans le secteur qui ouvre une vraie conversation.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => onStartCall(prospect)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
            >
              <PhoneCall className="h-4 w-4" />
              Appeler avec IACourtier
            </button>
            <Link
              href={`/tableau-de-bord/actions/prepare-first-seller-call?name=${encodeURIComponent(prospect.name)}&address=${encodeURIComponent(prospect.address)}&city=${encodeURIComponent(prospect.city)}&channel=sms&context=prospect`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-subtle bg-surface px-4 py-3 text-sm font-semibold hover:border-electric-500/40"
            >
              <Send className="h-4 w-4" />
              Preparer texto
            </Link>
            <button
              type="button"
              onClick={onSkipProspect}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-subtle bg-surface px-4 py-3 text-sm font-semibold hover:border-electric-500/40"
            >
              <SkipForward className="h-4 w-4" />
              Passer au prochain
            </button>
          </div>

          {isCalling ? (
            <div className="rounded-2xl border border-subtle bg-surface p-5">
              <p className="text-sm font-semibold text-electric-500">Resultat de l&apos;appel</p>
              <textarea
                value={callNote}
                onChange={(event) => onCallNoteChange(event.target.value)}
                rows={3}
                placeholder="Note rapide : ce qu'il a dit, objection, niveau d'interet, prochaine disponibilite..."
                className="mt-3 w-full rounded-2xl border border-subtle bg-surface-soft px-4 py-3 text-sm outline-none focus:border-electric-500"
              />
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {callOutcomes.map((outcome) => (
                  <button
                    key={outcome.value}
                    type="button"
                    onClick={() => onSaveOutcome(outcome.value)}
                    className="rounded-xl border border-subtle bg-surface-soft px-3 py-2 text-sm font-semibold hover:border-electric-500/40"
                  >
                    {outcome.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
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

function loadMission(): ProspectingMission | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(missionKey());
    if (!raw) return null;
    return JSON.parse(raw) as ProspectingMission;
  } catch {
    return null;
  }
}

function saveMission(mission: ProspectingMission | null) {
  if (typeof window === "undefined") return;
  if (!mission) {
    window.localStorage.removeItem(missionKey());
    return;
  }
  window.localStorage.setItem(missionKey(), JSON.stringify(mission));
}

function mergeMessages(current: CoachMessage[], incoming: CoachMessage[]) {
  const byId = new Map<string, CoachMessage>();
  [...current, ...incoming].forEach((message) => byId.set(message.id, message));

  return Array.from(byId.values())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-30);
}

function getMissionProspect(mission: ProspectingMission | null, prospects: SoniaProspect[]) {
  if (!mission?.active) return null;
  const id = mission.prospectIds[mission.currentIndex];
  return prospects.find((prospect) => prospect.id === id) || null;
}

function advanceMission(mission: ProspectingMission | null, result: CallResult): ProspectingMission | null {
  if (!mission) return null;
  if (result === "rendez_vous_obtenu") {
    return {
      ...mission,
      lastFeedback: "Rendez-vous obtenu. La mission change : on prepare l'analyse de marche avant la rencontre.",
    };
  }

  return {
    ...mission,
    currentIndex: Math.min(mission.currentIndex + 1, Math.max(mission.prospectIds.length - 1, 0)),
    lastFeedback: "Resultat note. On garde le rythme et on passe au prochain prospect.",
  };
}

function buildCallScript(prospect: SoniaProspect) {
  return `Bonjour ${prospect.name}, ici Sonia Bernier, courtiere immobiliere. Je suis active dans votre secteur en ce moment et je voulais simplement vous poser une petite question : est-ce que vendre votre propriete cette annee fait partie de vos reflexions, ou pas du tout?`;
}

function buildMissionFeedback(prospect: SoniaProspect, result: CallResult) {
  if (result === "pas_repondu") {
    return `Pas de reponse avec ${prospect.name}. C'est normal. Prochaine action : texto court et relance dans 2 jours. Ne t'arrete pas la, on passe au prochain.`;
  }
  if (result === "interesse") {
    return `${prospect.name} montre de l'ouverture. Ta prochaine meilleure question : "Qu'est-ce qui vous ferait bouger si le timing etait bon?" Ensuite, propose une courte rencontre d'evaluation.`;
  }
  if (result === "rendez_vous_obtenu") {
    return `Excellent. Rendez-vous vendeur obtenu avec ${prospect.name}. Maintenant, on prepare l'analyse de marche, les questions de decouverte et les arguments vendeur avant la rencontre.`;
  }
  if (result === "a_rappeler") {
    return `${prospect.name} accepte une relance. Bon signe. Mets la relance au calendrier et garde ton prochain message simple, humain et precis.`;
  }
  if (result === "pas_interesse") {
    return `${prospect.name} n'avance pas maintenant. Reste professionnelle, laisse une bonne impression et garde une relance long terme si c'est pertinent.`;
  }
  if (result === "deja_avec_courtier") {
    return `${prospect.name} est deja accompagne. On respecte ca, on l'exclut de la prospection active et on garde ton energie pour les prochains prospects.`;
  }
  return `Resultat note pour ${prospect.name}. On garde le fil et on avance vers la prochaine action.`;
}

function extractNoteValue(notes: string, label: string) {
  const line = notes
    .split("\n")
    .find((item) => item.toLowerCase().startsWith(label.toLowerCase()));
  return line?.split(":").slice(1).join(":").trim();
}

const callOutcomes: { label: string; value: CallResult }[] = [
  { label: "Pas repondu", value: "pas_repondu" },
  { label: "Interesse", value: "interesse" },
  { label: "Rendez-vous obtenu", value: "rendez_vous_obtenu" },
  { label: "A rappeler", value: "a_rappeler" },
  { label: "Pas interesse", value: "pas_interesse" },
  { label: "Deja avec courtier", value: "deja_avec_courtier" },
];
