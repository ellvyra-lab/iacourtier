"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";

import { MandateGeneratedContent } from "@/components/mandate-generated-content";
import { MandateActionGrid } from "@/components/mandate-action-grid";
import { MandateMarketAnalyses } from "@/components/mandate-market-analyses";

type LocalMandate = {
  id: string;
  address: string;
  city: string;
  property_type?: string;
  type?: string;
  asking_price?: string;
  price?: string;
  bedrooms: string;
  bathrooms: string;
  land_area?: string;
  lot?: string;
  description?: string;
  highlights?: string;
  schools?: string;
  transport?: string;
  particularities?: string[];
};

export function LocalMandatePage({ id }: { id: string }) {
  const [mandate, setMandate] = useState<LocalMandate | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(`iacourtier-mandate-${id}`);
    if (stored) setMandate(JSON.parse(stored) as LocalMandate);
  }, [id]);

  if (!mandate) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900/72">
        <h1 className="text-2xl font-semibold">Mandat introuvable</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Ce dossier local n&apos;existe plus dans ce navigateur.</p>
        <Link href="/tableau-de-bord/mandats/nouveau" className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
          Créer un nouveau mandat
        </Link>
      </div>
    );
  }

  const price = mandate.asking_price || mandate.price || "Prix à préciser";
  const propertyType = mandate.property_type || mandate.type || "Propriété";
  const summary = mandate.highlights || mandate.description || "Le dossier est créé. Vous pouvez maintenant générer des contenus à partir des informations du mandat.";

  return (
    <div className="space-y-6">
      <Link href="/tableau-de-bord/mandats" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
        <ChevronLeft className="h-4 w-4" />
        Retour aux mandats
      </Link>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-premium dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-300">
              <MapPin className="h-4 w-4" />
              {mandate.city}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{mandate.address}</h1>
            <p className="mt-3 max-w-3xl whitespace-pre-wrap text-slate-600 dark:text-slate-300">{summary}</p>
          </div>
          <div className="rounded-lg bg-slate-950 px-5 py-4 text-white dark:bg-white dark:text-slate-950">
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">Prix</p>
            <p className="mt-1 text-2xl font-semibold">{price}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ["Type", propertyType],
          ["Chambres", mandate.bedrooms || "À préciser"],
          ["Salle de bain", mandate.bathrooms || "À préciser"],
          ["Terrain", mandate.land_area || mandate.lot || "À préciser"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/72">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <MandateGeneratedContent mandatId={mandate.id} />

      <MandateMarketAnalyses mandatId={mandate.id} />

      <MandateActionGrid
        dossierId={mandate.id}
        isLocal
        context={{
          address: mandate.address,
          city: mandate.city,
          propertyType,
          price,
          bedrooms: mandate.bedrooms,
          bathrooms: mandate.bathrooms,
          landArea: mandate.land_area || mandate.lot || "",
          highlights: summary,
          features: [mandate.schools ? `Écoles : ${mandate.schools}` : "", mandate.transport ? `Transport : ${mandate.transport}` : ""].filter(Boolean).join("\n"),
          notes: Array.isArray(mandate.particularities) ? mandate.particularities.join(", ") : "",
        }}
      />
    </div>
  );
}
