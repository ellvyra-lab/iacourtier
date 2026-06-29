"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import type { MarketAnalysisRecord } from "@/lib/market-analysis";

export function MandateMarketAnalyses({ mandatId }: { mandatId: string }) {
  const [analyses, setAnalyses] = useState<MarketAnalysisRecord[]>([]);
  const [status, setStatus] = useState("Chargement des analyses générées...");

  useEffect(() => {
    let isMounted = true;

    async function loadAnalyses() {
      const localItems = JSON.parse(window.localStorage.getItem(`iacourtier-market-analyses-${mandatId}`) || "[]") as MarketAnalysisRecord[];

      try {
        const response = await fetch(`/api/market-analyses?mandatId=${mandatId}`);
        const payload = (await response.json()) as { analyses?: MarketAnalysisRecord[] };

        if (response.ok && isMounted) {
          setAnalyses([...(payload.analyses ?? []), ...localItems]);
          setStatus("");
          return;
        }
      } catch {
        // Supabase non configuré: on garde le repli local.
      }

      if (isMounted) {
        setAnalyses(localItems);
        setStatus(localItems.length ? "" : "Aucune analyse comparative générée pour ce mandat pour l’instant.");
      }
    }

    loadAnalyses();
    return () => {
      isMounted = false;
    };
  }, [mandatId]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Analyses générées</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Analyses comparatives associées à ce mandat.</p>
        </div>
      </div>

      {status ? <p className="mt-5 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">{status}</p> : null}

      {analyses.length ? (
        <div className="mt-5 grid gap-4">
          {analyses.map((analysis) => (
            <article key={analysis.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Analyse comparative</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {analysis.source_type === "pdf" ? `PDF${analysis.file_name ? ` · ${analysis.file_name}` : ""}` : `${analysis.objective || "Analyse comparative"} · ${analysis.style || "Style non précisé"}`}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(analysis.created_at))}
                </p>
              </div>
              <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{analysis.generated_text}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
