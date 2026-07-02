"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarCheck, FileWarning, Phone, Radar, RefreshCw, Sparkles, Users } from "lucide-react";

import { buildDailyCoach } from "@/lib/coach/daily-coach";
import { getSoniaProspects, type SoniaProspect } from "@/lib/sonia-beta";

export function DailyCoachDashboard() {
  const [prospects, setProspects] = useState<SoniaProspect[]>([]);

  useEffect(() => {
    setProspects(getSoniaProspects());
  }, []);

  const coach = useMemo(() => buildDailyCoach(prospects, "Sonia"), [prospects]);

  if (!coach.hasRealData) {
    return (
      <div className="space-y-7">
        <section className="rounded-2xl border border-subtle bg-surface-soft p-7">
          <p className="text-sm font-semibold text-electric-500">{coach.greeting}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Sonia, on part de zéro, et c’est parfait.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            Ta première mission est simple : débloquer tes premiers prospects Radar et faire tes appels.
          </p>
          <Link href="/tableau-de-bord/radar-prospection" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
            Commencer ma prospection
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-2xl border border-subtle bg-surface p-5">
          <p className="text-sm font-semibold text-electric-500">Plan de départ Sonia Beta</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["1", "Débloquer des prospects Radar"],
              ["2", "Créer un prospect vendeur"],
              ["3", "Faire un appel démo"],
              ["4", "Obtenir le feedback Coach"],
            ].map(([step, label]) => (
              <div key={step} className="rounded-2xl border border-subtle bg-surface-soft p-4">
                <p className="text-xs font-semibold text-electric-500">Étape {step}</p>
                <p className="mt-2 text-sm font-semibold leading-6">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {[
            "Je t’ai préparé des opportunités réalistes pour tester le workflow.",
            "Si ça ne répond pas, je te prépare le texto et la relance.",
            "Le but aujourd’hui n’est pas d’être parfaite. C’est de créer des conversations.",
          ].map((line) => (
            <div key={line} className="rounded-2xl border border-subtle bg-surface p-5 text-sm leading-6 text-muted">
              {line}
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-subtle bg-surface-soft p-7">
        <p className="text-sm font-semibold text-electric-500">{coach.greeting}</p>
        <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{coach.coachLine}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{coach.encouragement}</p>
            <Link href={coach.firstAction.href} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
              {coach.firstAction.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-sm text-muted">{coach.firstAction.description}</p>
          </div>
          <div className="rounded-2xl border border-subtle bg-background/80 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-electric-500" />
              Aujourd’hui, ton focus
            </p>
            <p className="mt-4 text-2xl font-semibold leading-tight">{coach.focus}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Phone} label="Appels à faire" value={coach.objective.callsToMake} />
        <Metric icon={Radar} label="Prospects Radar" value={coach.objective.radarProspects} />
        <Metric icon={RefreshCw} label="Relances dues" value={coach.objective.followupsDue} />
        <Metric icon={CalendarCheck} label="Rendez-vous à préparer" value={coach.objective.sellerAppointments} />
        <Metric icon={BarChart3} label="Analyses de marché" value={coach.objective.marketAnalyses} />
        <Metric icon={FileWarning} label="Documents manquants" value={coach.objective.missingDocuments} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-subtle bg-surface p-5">
          <p className="text-sm font-semibold text-electric-500">Plan de bataille</p>
          <div className="mt-5 space-y-3">
            <PlanRow title="1. Appeler les prospects Radar" items={coach.battlePlan.radarProspectsToCall} empty="Aucun prospect Radar à appeler." />
            <PlanRow title="2. Faire les relances dues" items={coach.battlePlan.followupsDue} empty="Aucune relance due." />
            <PlanRow title="3. Préparer les rendez-vous vendeurs" items={coach.battlePlan.sellerAppointmentsToPrepare} empty="Aucun rendez-vous vendeur à préparer." />
            <PlanRow title="4. Finaliser les analyses de marché" items={coach.battlePlan.marketAnalysesToPrepare} empty="Aucune analyse à finaliser." />
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
            <Link key={item.id} href={`/tableau-de-bord/prospects/${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-surface px-3 py-2 text-sm hover:border-electric-500/40">
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
