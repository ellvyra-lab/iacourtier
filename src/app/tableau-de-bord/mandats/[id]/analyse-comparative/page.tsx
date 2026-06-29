import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { MarketAnalysisAssistant } from "@/components/market-analysis-assistant";
import { getPropertyDossierById, propertyDossiers } from "@/data/property-dossiers";
import { mandatToSubjectProperty } from "@/lib/market-analysis";
import type { Mandat } from "@/lib/mandats";

type AnalyseComparativePageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return propertyDossiers.map((dossier) => ({ id: dossier.id }));
}

export async function generateMetadata({ params }: AnalyseComparativePageProps) {
  const { id } = await params;
  const dossier = getPropertyDossierById(id);

  return {
    title: dossier ? `Analyse comparative | ${dossier.address}` : "Analyse comparative | IACourtier",
  };
}

function dossierToMandat(id: string): Mandat | null {
  const dossier = getPropertyDossierById(id);
  if (!dossier) return null;

  return {
    id: dossier.id,
    address: dossier.address,
    city: dossier.city,
    property_type: dossier.type,
    asking_price: dossier.price,
    mls_number: null,
    bedrooms: dossier.bedrooms,
    bathrooms: dossier.bathrooms,
    garage: dossier.garage ? "Oui" : "Non",
    parking: null,
    pool: dossier.pool ? "Oui" : "Non",
    basement: null,
    fireplace: null,
    air_conditioning: null,
    living_area: null,
    land_area: dossier.lot,
    year_built: null,
    highlights: [dossier.description, dossier.neighborhood, dossier.schools, dossier.transport, ...dossier.particularities].join("\n"),
    marketing_style: "Professionnel",
    created_at: dossier.updatedAt,
  };
}

export default async function AnalyseComparativePage({ params }: AnalyseComparativePageProps) {
  const { id } = await params;
  const mandat = dossierToMandat(id);

  if (!mandat) notFound();

  return (
    <div className="space-y-7">
      <Link href={`/tableau-de-bord/mandats/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
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

      <MarketAnalysisAssistant mandatId={id} subjectProperty={mandatToSubjectProperty(mandat)} returnHref={`/tableau-de-bord/mandats/${id}`} />
    </div>
  );
}
