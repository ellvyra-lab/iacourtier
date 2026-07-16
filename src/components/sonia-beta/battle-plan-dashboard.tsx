"use client";

import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarCheck, FileText, Megaphone, Phone, Radar, RotateCcw, Sparkles, Target } from "lucide-react";

import { buildSoniaBattlePlan, getSoniaProspects, type SoniaBattlePlan, type SoniaProspect } from "@/lib/sonia-beta";
import { INFORMATION_REQUEST_NEXT_ACTION } from "@/lib/sonia-beta/storage";
import { DirectorChatPanel } from "@/components/director-chat-panel";
import type { CoachMessageResponse } from "@/app/api/coach/message/route";

type TodayPriority = {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
};

function buildTodayPriority(prospects: SoniaProspect[], plan: SoniaBattlePlan): TodayPriority {
  const informationRequest = prospects.find((prospect) => prospect.nextAction === INFORMATION_REQUEST_NEXT_ACTION);
  if (informationRequest) {
    return {
      icon: "📩",
      title: "Nouvelle demande d'information",
      description: `${informationRequest.name} attend un premier contact.`,
      buttonLabel: "Préparer le premier appel",
      href: `/tableau-de-bord/actions/prepare-first-seller-call?name=${encodeURIComponent(informationRequest.name)}&address=${encodeURIComponent(informationRequest.address)}&context=prospect`,
    };
  }

  if (plan.sellerAppointmentsToPrepare.length) {
    return {
      icon: "🏠",
      title: "Rendez-vous vendeur prévu",
      description: "Un rendez-vous vendeur est prévu. Prépare l'évaluation avant la rencontre.",
      buttonLabel: "Préparer le rendez-vous",
      href: "/tableau-de-bord/actions/prepare-market-analysis",
    };
  }

  if (plan.followupsDue.length) {
    return {
      icon: "📞",
      title: "Suivis dus",
      description: "Des suivis sont dus aujourd'hui. Ne laisse pas refroidir tes prospects.",
      buttonLabel: "Faire les suivis",
      href: "/tableau-de-bord/prospects",
    };
  }

  if (plan.marketAnalysesToPrepare.length) {
    return {
      icon: "📊",
      title: "Analyse de marché à terminer",
      description: "Termine l'analyse de marché avant le prochain rendez-vous.",
      buttonLabel: "Préparer l'analyse",
      href: "/tableau-de-bord/actions/prepare-market-analysis",
    };
  }

  return {
    icon: "🎯",
    title: "Prospecter",
    description: "Aucune urgence en attente. Trouve de nouveaux prospects.",
    buttonLabel: "Ouvrir le Radar",
    href: "/tableau-de-bord/radar-prospection",
  };
}

const fallbackFocusLines = [
  "Prospection avant perfection.",
  "Un appel vaut mieux que dix idées.",
  "Ton prochain mandat commence probablement par un suivi.",
  "Commence pendant que ton énergie est haute.",
];

const fallbackCoachMessage: CoachMessageResponse = {
  greeting: "Bonjour Sonia 👋",
  mainMessage: "Aujourd'hui, on va avancer. Je t'ai préparé ton plan de bataille.",
  focus: fallbackFocusLines[new Date().getDay() % fallbackFocusLines.length],
  recommendation: "On garde ça simple : appels, relances, rendez-vous vendeurs, analyses de marché avant la rencontre, puis documents et mise en marché quand le mandat est signé.",
};

export function BattlePlanDashboard() {
  const [prospects, setProspects] = useState<SoniaProspect[]>([]);
  const [coachMessage, setCoachMessage] = useState<CoachMessageResponse>(fallbackCoachMessage);
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);

  useEffect(() => {
    setProspects(getSoniaProspects());
  }, []);

  const realProspects = useMemo(() => prospects.filter((prospect) => !prospect.id.startsWith("sonia-demo-")), [prospects]);
  const workingProspects = useMemo(() => (realProspects.length ? prospects : []), [prospects, realProspects.length]);
  const plan = useMemo(() => buildSoniaBattlePlan(workingProspects), [workingProspects]);
  
  // Generate coach message from OpenAI
  useEffect(() => {
    async function fetchCoachMessage() {
      setIsLoadingMessage(true);
      try {
        const res = await fetch("/api/coach/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: "Sonia",
            plan: {
              callsToMake: plan.callsToMake.length,
              radarProspectsToCall: plan.radarProspectsToCall.length,
              followupsDue: plan.followupsDue.length,
              sellerAppointmentsToPrepare: plan.sellerAppointmentsToPrepare.length,
              marketAnalysesToPrepare: plan.marketAnalysesToPrepare.length,
              mandatesWithMissingDocuments: plan.mandatesWithMissingDocuments.length,
              marketingActionsToGenerate: plan.marketingActionsToGenerate.length,
            },
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as CoachMessageResponse;
          setCoachMessage(data);
        } else {
          console.error("Failed to fetch coach message:", res.status);
        }
      } catch (err) {
        console.error("Error fetching coach message:", err);
      } finally {
        setIsLoadingMessage(false);
      }
    }

    fetchCoachMessage();
  }, [plan]);
  
  const recommendations = buildCoachRecommendations(plan);
  const isEmpty = workingProspects.length === 0;
  const todayPriority = useMemo(() => buildTodayPriority(workingProspects, plan), [workingProspects, plan]);

  return (
    <div className="space-y-7">
      <DirectorChatPanel prospects={workingProspects} plan={plan} />

      <MissionDuJourSection priority={todayPriority} />

      <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Ma journée</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{coachMessage.greeting}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{coachMessage.mainMessage}</p>
          </div>
          <div className="max-w-xl rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-3 dark:border-teal-900 dark:bg-teal-950/30">
            <p className="flex items-center gap-2 text-xs font-semibold text-teal-900 dark:text-teal-100">
              <Target className="h-4 w-4" />
              Focus : {coachMessage.focus}
            </p>
          </div>
        </div>
      </section>

      {isEmpty ? <EmptyCoachState /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ObjectiveCard icon={Phone} label="Appels à faire" value={plan.callsToMake.length} />
        <ObjectiveCard icon={Radar} label="Prospects Radar" value={plan.radarProspectsToCall.length} />
        <ObjectiveCard icon={RotateCcw} label="Relances dues" value={plan.followupsDue.length} />
        <ObjectiveCard icon={CalendarCheck} label="Rendez-vous à préparer" value={plan.sellerAppointmentsToPrepare.length} />
        <ObjectiveCard icon={BarChart3} label="Analyses à finaliser" value={plan.marketAnalysesToPrepare.length} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
          <Sparkles className="h-4 w-4" />
          Ce que je te recommande
        </p>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {recommendations.map((recommendation) => (
            <div key={recommendation} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200">
              {recommendation}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Plan de bataille</p>
        <div className="mt-5 space-y-3">
          <BattleStep index={1} icon={Radar} title="Appeler les prospects Radar" items={plan.radarProspectsToCall} empty="Débloque tes premiers prospects Radar, puis passe aux appels." />
          <BattleStep index={2} icon={RotateCcw} title="Faire les relances dues" items={plan.followupsDue} empty="Aucune relance due pour le moment." />
          <BattleStep index={3} icon={CalendarCheck} title="Préparer les rendez-vous vendeurs" items={plan.sellerAppointmentsToPrepare} empty="Aucun rendez-vous vendeur à préparer." />
          <BattleStep index={4} icon={BarChart3} title="Finaliser les analyses de marché" items={plan.marketAnalysesToPrepare} empty="Aucune analyse à finaliser. Rappel : elle se prépare avant le rendez-vous vendeur." />
          <BattleStep index={5} icon={Megaphone} title="Générer les actions marketing si nécessaire" items={plan.marketingActionsToGenerate} empty="Aucune mise en marché urgente." />
          <BattleStep index={6} icon={FileText} title="Compléter les documents vendeur après mandat signé" items={plan.mandatesWithMissingDocuments} empty="Aucun document vendeur manquant." />
        </div>
      </section>
    </div>
  );
}

function MissionDuJourSection({ priority }: { priority: TodayPriority }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Mission du jour</p>
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="mr-2" aria-hidden="true">
                {priority.icon}
              </span>
              {priority.title}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{priority.description}</p>
          </div>
          <Link href={priority.href} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            {priority.buttonLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

function EmptyCoachState() {
  return (
    <section className="rounded-lg border border-teal-200 bg-teal-50/70 p-6 shadow-sm dark:border-teal-900 dark:bg-teal-950/30">
      <p className="text-xl font-semibold tracking-tight text-teal-950 dark:text-teal-50">
        Sonia, on part de zéro, et c&apos;est parfait.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-teal-900/80 dark:text-teal-100/80">
        La première mission est simple : créer ou débloquer tes premiers prospects Radar, puis faire tes appels.
      </p>
      <Link href="/tableau-de-bord/radar-prospection" className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
        Trouver mes premiers prospects
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function ObjectiveCard({ icon: Icon, label, value }: { icon: ElementType; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <Icon className="h-4 w-4 text-teal-600" />
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function BattleStep({ index, icon: Icon, title, items, empty }: { index: number; icon: ElementType; title: string; items: SoniaProspect[]; empty: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">{index}</span>
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <Icon className="h-4 w-4 text-teal-600" />
              {title}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{items.length ? `${items.length} action${items.length > 1 ? "s" : ""} prête${items.length > 1 ? "s" : ""}` : empty}</p>
          </div>
        </div>
        {items[0] ? (
          <Link href={`/tableau-de-bord/prospects/${items[0].id}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            Ouvrir
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function buildCoachRecommendations(plan: ReturnType<typeof buildSoniaBattlePlan>) {
  const recommendations: string[] = [];

  if (plan.radarProspectsToCall.length || plan.callsToMake.length) {
    recommendations.push("Commence par tes appels avant d’ouvrir tes courriels.");
    recommendations.push(`Tu as ${Math.max(plan.radarProspectsToCall.length, plan.callsToMake.length)} prospect${Math.max(plan.radarProspectsToCall.length, plan.callsToMake.length) > 1 ? "s" : ""} à contacter. Appelle pendant que ton énergie est haute.`);
  }

  if (plan.followupsDue.length) {
    recommendations.push("Ce vendeur attend ton suivi aujourd’hui. Ne le laisse pas refroidir.");
  }

  if (plan.sellerAppointmentsToPrepare.length || plan.marketAnalysesToPrepare.length) {
    recommendations.push("Tu as un rendez-vous vendeur à préparer. L’analyse de marché doit être prête avant la rencontre.");
  }

  if (plan.mandatesWithMissingDocuments.length) {
    recommendations.push("Après mandat signé, ton focus est clair : documents vendeur et mise en marché.");
  }

  if (plan.marketingActionsToGenerate.length) {
    recommendations.push("Ta mise en marché doit sortir vite et propre. Génère les contenus avant de te perdre dans les détails.");
  }

  return recommendations.length
    ? recommendations.slice(0, 5)
    : [
        "Prospection avant perfection. Trouve tes premiers prospects et fais tes appels.",
        "Ne cherche pas la journée parfaite. Cherche la prochaine conversation.",
        "Ton prochain mandat commence probablement par un suivi.",
      ];
}
