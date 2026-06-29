"use client";

import { useState } from "react";

import { MandateDocumentImporter } from "@/components/mandate-document-importer";
import { NewMandateWizard } from "@/components/new-mandate-wizard";

export function NewMandateEntry() {
  const [mode, setMode] = useState<"choice" | "documents" | "manual">("choice");

  if (mode === "documents") return <MandateDocumentImporter />;
  if (mode === "manual") return <NewMandateWizard />;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <article className="rounded-lg border border-teal-300 bg-white p-6 shadow-premium dark:border-teal-900 dark:bg-slate-900/72">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <span className="text-2xl leading-none" aria-hidden="true">
              📎
            </span>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-200">
            Recommandé
          </span>
        </div>
        <p className="mt-6 text-sm font-medium text-teal-700 dark:text-teal-300">Option 1</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Déposer les documents du mandat</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Déposez un certificat de localisation, un compte de taxes, un acte de vente ou une déclaration du vendeur. IACourtier extraira automatiquement les informations importantes.
        </p>
        <button
          type="button"
          onClick={() => setMode("documents")}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          Déposer des PDF
        </button>
      </article>

      <article className="rounded-lg border border-slate-200 bg-white/72 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className="text-2xl leading-none" aria-hidden="true">
            ✍
          </span>
        </div>
        <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">Option 2</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Saisir les informations manuellement</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Utilisez cette option seulement si vous n’avez pas les documents PDF sous la main.
        </p>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          Commencer manuellement
        </button>
      </article>
    </div>
  );
}
