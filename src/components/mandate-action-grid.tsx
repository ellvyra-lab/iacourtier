import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { mandateGenerators } from "@/data/mandate-generators";

function statusClasses(status: string) {
  if (status === "Disponible") return "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

type MandateActionContext = {
  address?: string;
  city?: string;
  propertyType?: string;
  price?: string;
  bedrooms?: string;
  bathrooms?: string;
  landArea?: string;
  livingArea?: string;
  yearBuilt?: string;
  garage?: string;
  pool?: string;
  highlights?: string;
  features?: string;
  notes?: string;
};

function contextQuery(context?: MandateActionContext) {
  if (!context) return "";
  const params = new URLSearchParams({
    context: "mandat",
    address: context.address || "",
    city: context.city || "",
    propertyType: context.propertyType || "",
    price: context.price || "",
    bedrooms: context.bedrooms || "",
    bathrooms: context.bathrooms || "",
    landArea: context.landArea || "",
    livingArea: context.livingArea || "",
    yearBuilt: context.yearBuilt || "",
    garage: context.garage || "",
    pool: context.pool || "",
    highlights: context.highlights || "",
    features: context.features || "",
    notes: context.notes || "",
  });
  return params.toString();
}

function generatorHref(generatorId: string, dossierId: string, isLocal: boolean, context?: MandateActionContext) {
  const query = contextQuery(context);

  if (generatorId === "description-propriete") {
    return `/tableau-de-bord/actions/generate-marketing-launch${query ? `?${query}` : ""}`;
  }

  if (generatorId === "analyse-comparative") {
    return `/tableau-de-bord/mandats/${isLocal ? `local/${dossierId}` : dossierId}/analyse-comparative`;
  }

  if (generatorId === "facebook") {
    return `/tableau-de-bord/actions/generate-marketing-launch${query ? `?${query}` : ""}`;
  }

  if (generatorId === "plan-marketing") {
    return `/tableau-de-bord/actions/generate-marketing-launch${query ? `?${query}` : ""}`;
  }

  return "#";
}

export function MandateActionGrid({ dossierId, isLocal = false, context }: { dossierId: string; isLocal?: boolean; context?: MandateActionContext }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div>
        <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Travail sur le mandat</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Que souhaitez-vous créer avec ce mandat ?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Chaque création utilise automatiquement les informations du dossier. Le courtier reste dans son mandat, pas dans une liste d&apos;assistants.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mandateGenerators.map((generator) => (
          <Link
            key={generator.id}
            href={generatorHref(generator.id, dossierId, isLocal, context)}
            className="group min-h-44 rounded-lg border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-teal-300 hover:bg-white hover:shadow-premium dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-teal-900 dark:hover:bg-slate-900"
            aria-disabled={generator.status !== "Disponible"}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100">
                <generator.icon className="h-5 w-5" />
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(generator.status)}`}>
                {generator.status}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-semibold">{generator.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{generator.description}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100 dark:text-teal-300">
              {generator.id === "analyse-comparative" ? "Créer l’analyse" : generator.status === "Disponible" ? "Créer" : "Bientôt disponible"}
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
