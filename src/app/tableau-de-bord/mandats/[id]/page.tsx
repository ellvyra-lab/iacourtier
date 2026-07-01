import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";

import { MandateGeneratedContent } from "@/components/mandate-generated-content";
import { MandateMarketAnalyses } from "@/components/mandate-market-analyses";
import { MandateActionGrid } from "@/components/mandate-action-grid";
import { buildPropertyAssistantContext, getPropertyDossierById, propertyDossiers } from "@/data/property-dossiers";

type DossierPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return propertyDossiers.map((dossier) => ({ id: dossier.id }));
}

export async function generateMetadata({ params }: DossierPageProps) {
  const { id } = await params;
  const dossier = getPropertyDossierById(id);

  return {
    title: dossier ? `${dossier.address} | IACourtier` : "Dossier introuvable | IACourtier",
  };
}

export default async function DossierPage({ params }: DossierPageProps) {
  const { id } = await params;
  const dossier = getPropertyDossierById(id);

  if (!dossier) notFound();

  const context = buildPropertyAssistantContext(dossier);

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
              {dossier.city}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{dossier.address}</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">{dossier.description}</p>
          </div>
          <div className="rounded-lg bg-slate-950 px-5 py-4 text-white dark:bg-white dark:text-slate-950">
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">Prix</p>
            <p className="mt-1 text-2xl font-semibold">{dossier.price}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/72">
          <h2 className="text-lg font-semibold">Dossier Propriété</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Adresse", context.address],
              ["Ville", context.city],
              ["Type", context.type],
              ["Prix", context.price],
              ["Chambres", context.bedrooms],
              ["Salle de bain", context.bathrooms],
              ["Terrain", context.lot],
              ["Piscine", context.pool ? "Oui" : "Non"],
              ["Garage", context.garage ? "Oui" : "Non"],
              ["Quartier", context.neighborhood],
              ["Écoles", context.schools],
              ["Transport", context.transport],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ListBlock title="Caractéristiques" items={context.characteristics} />
            <ListBlock title="Particularités" items={context.particularities} />
          </div>
        </div>
      </section>

      <MandateGeneratedContent mandatId={dossier.id} />

      <MandateMarketAnalyses mandatId={dossier.id} />

      <MandateActionGrid
        dossierId={dossier.id}
        context={{
          address: dossier.address,
          city: dossier.city,
          propertyType: dossier.type,
          price: dossier.price,
          bedrooms: dossier.bedrooms,
          bathrooms: dossier.bathrooms,
          landArea: dossier.lot,
          garage: dossier.garage ? "Oui" : "Non",
          pool: dossier.pool ? "Oui" : "Non",
          highlights: dossier.description,
          features: dossier.characteristics.join(", "),
          notes: [dossier.neighborhood, dossier.schools, dossier.transport, ...dossier.particularities].join("\n"),
        }}
      />
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
