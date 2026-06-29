"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { propertyDossiers } from "@/data/property-dossiers";

type LocalMandateSummary = {
  id: string;
  address: string;
  city: string;
  property_type?: string;
  type?: string;
  asking_price?: string;
  price?: string;
  created_at?: string;
};

export function MandatesList() {
  const [localMandates, setLocalMandates] = useState<LocalMandateSummary[]>([]);

  useEffect(() => {
    const mandates: LocalMandateSummary[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("iacourtier-mandate-")) continue;
      const stored = window.localStorage.getItem(key);
      if (!stored) continue;
      try {
        mandates.push(JSON.parse(stored) as LocalMandateSummary);
      } catch {
        // Ignore les anciens brouillons locaux invalides.
      }
    }
    mandates.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    setLocalMandates(mandates);
  }, []);

  const allMandates = useMemo(
    () => [
      ...localMandates.map((mandate) => ({
        id: mandate.id,
        href: `/tableau-de-bord/mandats/local/${mandate.id}`,
        address: mandate.address,
        city: mandate.city,
        price: mandate.asking_price || mandate.price || "Prix à préciser",
        type: mandate.property_type || mandate.type || "Propriété",
        createdAt: mandate.created_at || new Date().toISOString(),
        source: "Créé",
      })),
      ...propertyDossiers.map((dossier) => ({
        id: dossier.id,
        href: `/tableau-de-bord/mandats/${dossier.id}`,
        address: dossier.address,
        city: dossier.city,
        price: dossier.price,
        type: dossier.type,
        createdAt: dossier.updatedAt,
        source: "Exemple",
      })),
    ],
    [localMandates],
  );

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {allMandates.map((mandate) => (
        <article key={`${mandate.source}-${mandate.id}`} className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-premium dark:border-slate-800 dark:bg-slate-900/72">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{mandate.type}</p>
              <h2 className="mt-2 text-lg font-semibold">{mandate.address}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{mandate.city}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {mandate.source}
            </span>
          </div>
          <p className="mt-5 text-2xl font-semibold">{mandate.price}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Créé le {new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(new Date(mandate.createdAt))}
          </p>
          <Link href={mandate.href} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
            Ouvrir
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      ))}
    </section>
  );
}
