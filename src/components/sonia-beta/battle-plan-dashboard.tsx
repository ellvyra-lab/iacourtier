"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarCheck, FileText, Megaphone, Phone, Radar, RotateCcw, ShieldCheck } from "lucide-react";

import { buildSoniaBattlePlan, getSoniaProspects, type SoniaProspect } from "@/lib/sonia-beta";

export function BattlePlanDashboard() {
  const [prospects, setProspects] = useState<SoniaProspect[]>([]);

  useEffect(() => {
    setProspects(getSoniaProspects());
  }, []);

  const plan = useMemo(() => buildSoniaBattlePlan(prospects), [prospects]);
  const totalActions =
    plan.radarProspectsToCall.length +
    plan.callsToMake.length +
    plan.followupsDue.length +
    plan.sellerAppointmentsToPrepare.length +
    plan.marketAnalysesToPrepare.length +
    plan.mandatesWithMissingDocuments.length +
    plan.marketingActionsToGenerate.length;

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-7">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Sonia Beta</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Plan de bataille aujourd&apos;hui</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Radar, appels, suivis, rendez-vous vendeurs, analyses de marché, documents et mise en marché sont regroupés dans un seul parcours de travail.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Priorité du jour</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight">{totalActions}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">actions prêtes à exécuter</p>
            <Link href="/tableau-de-bord/radar-prospection" className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
              Ouvrir le Radar
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Radar} label="Prospects Radar à appeler" value={plan.radarProspectsToCall.length} />
        <MetricCard icon={Phone} label="Appels à faire" value={plan.callsToMake.length} />
        <MetricCard icon={RotateCcw} label="Relances dues" value={plan.followupsDue.length} />
        <MetricCard icon={CalendarCheck} label="Rendez-vous à préparer" value={plan.sellerAppointmentsToPrepare.length} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ActionList title="Prospects Radar à appeler aujourd'hui" icon={Radar} items={plan.radarProspectsToCall} empty="Aucun prospect Radar en attente d'appel." />
        <ActionList title="Appels à faire" icon={Phone} items={plan.callsToMake} empty="Aucun appel prioritaire." />
        <ActionList title="Relances dues" icon={RotateCcw} items={plan.followupsDue} empty="Aucune relance due aujourd'hui." />
        <ActionList title="Rendez-vous vendeurs à préparer" icon={CalendarCheck} items={plan.sellerAppointmentsToPrepare} empty="Aucun rendez-vous vendeur à préparer." />
        <ActionList title="Analyses de marché à faire" icon={BarChart3} items={plan.marketAnalysesToPrepare} empty="Aucune analyse de marché en attente." />
        <ActionList title="Mandats avec documents manquants" icon={FileText} items={plan.mandatesWithMissingDocuments} empty="Aucun mandat avec documents manquants." />
        <ActionList title="Actions marketing à générer" icon={Megaphone} items={plan.marketingActionsToGenerate} empty="Aucune action marketing urgente." />
        <section className="rounded-lg border border-teal-200 bg-teal-50/70 p-5 dark:border-teal-900 dark:bg-teal-950/30">
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
            <ShieldCheck className="h-4 w-4" />
            Workflow connecté
          </p>
          <div className="mt-4 space-y-2 text-sm leading-6 text-teal-900/80 dark:text-teal-100/80">
            <p>Radar → Prospect → Appel → Coach → Suivi → Rendez-vous vendeur.</p>
            <p>Rendez-vous obtenu → analyse de marché avant la rencontre.</p>
            <p>Mandat signé → documents vendeur et mise en marché.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Radar; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <Icon className="h-4 w-4 text-teal-600" />
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function ActionList({ title, icon: Icon, items, empty }: { title: string; icon: typeof Radar; items: SoniaProspect[]; empty: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
        <Icon className="h-4 w-4" />
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <Link key={item.id} href={`/tableau-de-bord/prospects/${item.id}`} className="block rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-teal-200 hover:bg-teal-50/60 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-teal-900 dark:hover:bg-teal-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.address ? `${item.address}, ${item.city}` : item.city}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">{item.status}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-teal-700 dark:text-teal-300">{item.nextAction}</p>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{empty}</p>
        )}
      </div>
    </section>
  );
}
