"use client";

import { useState } from "react";

export default function ProspectPage() {
  const [isReachabilityPanelOpen, setIsReachabilityPanelOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <h1 className="text-2xl font-semibold tracking-tight">Fiche Prospect</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="Nom" value="Non renseigné" />
          <InfoField label="Adresse" value="Non renseignée" />
          <InfoField label="Ville" value="Non renseignée" />
          <InfoField label="Téléphone" value="Non renseigné" />
          <InfoField label="Courriel" value="Non renseigné" />
          <InfoField label="Statut" value="Non défini" />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => setIsReachabilityPanelOpen((current) => !current)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            📞 Trouver comment le joindre
          </button>
          <ActionButton label="☎️ Appeler" />
          <ActionButton label="✉ Envoyer un courriel" />
          <ActionButton label="💬 Messenger" />
          <ActionButton label="📄 Préparer une lettre" />
          <ActionButton label="📝 Notes" />
          <ActionButton label="📅 Historique" />
        </div>
      </section>

      {isReachabilityPanelOpen ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          Panneau vide - Trouver comment le joindre.
        </section>
      ) : null}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function ActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
    >
      {label}
    </button>
  );
}
