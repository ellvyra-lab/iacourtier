import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

import { MandatesList } from "@/components/mandates-list";
import { propertyDossiers, propertyDossierFields } from "@/data/property-dossiers";

export default function MandatsPage() {
  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Mandats</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Mes mandats</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
            Chaque mandat contient un Dossier Propriété complet. Les assistants pourront s&apos;en servir comme source de vérité.
          </p>
        </div>
        <Link href="/tableau-de-bord/mandats/nouveau" className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
          <Plus className="h-4 w-4" />
          Nouveau mandat
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex items-center gap-3">
          <FolderKanban className="h-5 w-5 text-teal-600" />
          <div>
            <h2 className="font-semibold">Structure Dossier Propriété</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Champs normalisés pour alimenter automatiquement les assistants.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {propertyDossierFields.map((field) => (
            <span key={field} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {field}
            </span>
          ))}
        </div>
      </section>

      <MandatesList />
    </div>
  );
}
