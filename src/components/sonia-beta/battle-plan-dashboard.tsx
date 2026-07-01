"use client";

import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarCheck, FileText, Megaphone, Phone, Radar, RotateCcw, Sparkles, Target } from "lucide-react";

import { buildSoniaBattlePlan, getSoniaProspects, type SoniaProspect } from "@/lib/sonia-beta";

const focusLines = [
  "Prospection avant perfection.",
  "Un appel vaut mieux que dix idées.",
  "Ton prochain mandat commence probablement par un suivi.",
  "Commence pendant que ton énergie est haute.",
];

export function BattlePlanDashboard() {
  const [prospects, setProspects] = useState<SoniaProspect[]>([]);

  useEffect(() => {
    setProspects(getSoniaProspects());
  }, []);

  const realProspects = useMemo(() => prospects.filter((prospect) => !prospect.id.startsWith("sonia-demo-")), [prospects]);
  const workingProspects = useMemo(() => (realProspects.length ? prospects : []), [prospects, realProspects.length]);
  const plan = useMemo(() => buildSoniaBattlePlan(workingProspects), [workingProspects]);
  const firstAction = getFirstPriorityAction(plan);
  const recommendations = buildCoachRecommendations(plan);
  const isEmpty = workingProspects.length === 0;

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Coach IA</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Bonjour Sonia 👋</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-200">
              Aujourd&apos;hui, on va avancer. Je t&apos;ai préparé ton plan de bataille.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              On garde ça simple : appels, relances, rendez-vous vendeurs, analyses de marché avant la rencontre, puis documents et mise en marché quand le mandat est signé.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={firstAction.href} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
                Commencer ma journée
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/tableau-de-bord/radar-prospection" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-950">
                Ouvrir le Radar
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-5 dark:border-teal-900 dark:bg-teal-950/30">
            <p className="flex items-center gap-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
              <Target className="h-4 w-4" />
              Aujourd&apos;hui, ton focus
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-teal-950 dark:text-teal-50">{focusLines[new Date().getDay() % focusLines.length]}</p>
            <p className="mt-3 text-sm leading-6 text-teal-900/75 dark:text-teal-100/75">
              Fais les actions qui créent du mouvement avant d&apos;ouvrir les détails qui peuvent attendre.
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

function getFirstPriorityAction(plan: ReturnType<typeof buildSoniaBattlePlan>) {
  const firstProspect = plan.radarProspectsToCall[0] || plan.callsToMake[0];
  if (firstProspect) return { href: `/tableau-de-bord/prospects/${firstProspect.id}` };

  const firstFollowup = plan.followupsDue[0];
  if (firstFollowup) return { href: `/tableau-de-bord/prospects/${firstFollowup.id}` };

  const firstAppointment = plan.sellerAppointmentsToPrepare[0] || plan.marketAnalysesToPrepare[0];
  if (firstAppointment) return { href: `/tableau-de-bord/prospects/${firstAppointment.id}` };

  return { href: "/tableau-de-bord/radar-prospection" };
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
