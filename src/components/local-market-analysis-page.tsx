"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { MarketAnalysisAssistant } from "@/components/market-analysis-assistant";
import { localMandatToMandat, type Mandat } from "@/lib/mandats";
import { mandatToSubjectProperty } from "@/lib/market-analysis";

export function LocalMarketAnalysisPage({ id }: { id: string }) {
  const [mandat, setMandat] = useState<Mandat | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(`iacourtier-mandate-${id}`);
    if (stored) setMandat(localMandatToMandat(JSON.parse(stored) as Record<string, unknown>));
  }, [id]);

  if (!mandat) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900/72">
        <h1 className="text-2xl font-semibold">Mandat introuvable</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Ce dossier local n&apos;existe plus dans ce navigateur.</p>
        <Link href="/tableau-de-bord/mandats" className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
          Retour aux mandats
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <Link href={`/tableau-de-bord/mandats/local/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
        <ChevronLeft className="h-4 w-4" />
        Retour au mandat
      </Link>

      <div>
        <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Assistant Analyse comparative</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Analyse comparative</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Importez ou saisissez vos comparables et obtenez une synthèse claire pour votre rencontre vendeur.
        </p>
      </div>

      <MarketAnalysisAssistant mandatId={id} subjectProperty={mandatToSubjectProperty(mandat)} returnHref={`/tableau-de-bord/mandats/local/${id}`} />
    </div>
  );
}
