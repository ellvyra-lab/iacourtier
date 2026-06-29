import Link from "next/link";

import { NewMandateEntry } from "@/components/new-mandate-entry";

export default function NouveauMandatPage() {
  return (
    <div className="space-y-7">
      <Link href="/tableau-de-bord" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
        <span aria-hidden="true">←</span>
        Retour au dashboard
      </Link>
      <div>
        <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Nouveau mandat</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Créer un dossier de mandat</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Entrez les informations une seule fois. IACourtier les réutilisera ensuite pour chaque création liée au mandat.
        </p>
      </div>
      <NewMandateEntry />
    </div>
  );
}
