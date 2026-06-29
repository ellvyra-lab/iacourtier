"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Home, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type MandateDraft = {
  address: string;
  city: string;
  propertyType: string;
  askingPrice: string;
  mlsNumber: string;
  bedrooms: string;
  bathrooms: string;
  garage: string;
  parking: string;
  pool: string;
  basement: string;
  fireplace: string;
  airConditioning: string;
  livingArea: string;
  landArea: string;
  yearBuilt: string;
  renovations: string;
  neighborhood: string;
  schools: string;
  transport: string;
  yard: string;
  brightness: string;
  particularities: string;
  marketingStyle: string;
};

const initialDraft: MandateDraft = {
  address: "",
  city: "",
  propertyType: "Maison",
  askingPrice: "",
  mlsNumber: "",
  bedrooms: "",
  bathrooms: "",
  garage: "",
  parking: "",
  pool: "",
  basement: "",
  fireplace: "",
  airConditioning: "",
  livingArea: "",
  landArea: "",
  yearBuilt: "",
  renovations: "",
  neighborhood: "",
  schools: "",
  transport: "",
  yard: "",
  brightness: "",
  particularities: "",
  marketingStyle: "Chaleureux",
};

const steps = ["Informations générales", "Caractéristiques", "Points forts", "Style marketing"];
const styles = ["Familial", "Haut de gamme", "Chaleureux", "Moderne", "Investisseur", "Neutre"];

export function NewMandateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<MandateDraft>(initialDraft);

  const canContinue = useMemo(() => {
    if (step === 0) return draft.address.trim() && draft.city.trim() && draft.propertyType.trim() && draft.askingPrice.trim();
    if (step === 1) return draft.bedrooms.trim() || draft.bathrooms.trim() || draft.livingArea.trim() || draft.landArea.trim();
    if (step === 2) return [draft.renovations, draft.neighborhood, draft.schools, draft.transport, draft.yard, draft.brightness, draft.particularities].some((value) => value.trim());
    return Boolean(draft.marketingStyle);
  }, [draft, step]);

  function update<K extends keyof MandateDraft>(key: K, value: MandateDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function createMandate() {
    const id = `local-${Date.now()}`;
    const highlights = [
      draft.renovations ? `Rénovations: ${draft.renovations}` : null,
      draft.neighborhood ? `Quartier: ${draft.neighborhood}` : null,
      draft.schools ? `Écoles: ${draft.schools}` : null,
      draft.transport ? `Transport: ${draft.transport}` : null,
      draft.yard ? `Cour: ${draft.yard}` : null,
      draft.brightness ? `Luminosité: ${draft.brightness}` : null,
      draft.particularities ? `Particularités: ${draft.particularities}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      id,
      address: draft.address,
      city: draft.city,
      property_type: draft.propertyType,
      asking_price: draft.askingPrice,
      mls_number: draft.mlsNumber,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      garage: draft.garage,
      parking: draft.parking,
      pool: draft.pool,
      basement: draft.basement,
      fireplace: draft.fireplace,
      air_conditioning: draft.airConditioning,
      living_area: draft.livingArea,
      land_area: draft.landArea,
      year_built: draft.yearBuilt,
      highlights,
      marketing_style: draft.marketingStyle,
      created_at: new Date().toISOString(),
      type: draft.propertyType,
      price: draft.askingPrice,
      description: highlights,
      lot: draft.landArea,
      neighborhood: draft.neighborhood,
      schools: draft.schools,
      transport: draft.transport,
      particularities: draft.particularities
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    };

    window.localStorage.setItem(`iacourtier-mandate-${id}`, JSON.stringify(payload));
    router.push(`/tableau-de-bord/mandats/local/${id}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
      <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72 xl:sticky xl:top-8 xl:self-start">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Mandat intelligent</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Création guidée</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition",
                step === index ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs", step > index ? "bg-teal-500 text-white" : "bg-white/10 ring-1 ring-inset ring-slate-300 dark:ring-slate-700")}>
                {step > index ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              {label}
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-premium dark:border-slate-800 dark:bg-slate-900/72 sm:p-6">
        <div className="mb-6 flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-300">
          <Sparkles className="h-4 w-4" />
          Étape {step + 1} sur {steps.length}
        </div>

        {step === 0 ? (
          <Step title="Informations générales">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Adresse" value={draft.address} onChange={(value) => update("address", value)} />
              <Field label="Ville" value={draft.city} onChange={(value) => update("city", value)} />
              <Select label="Type de propriété" value={draft.propertyType} onChange={(value) => update("propertyType", value)} options={["Maison", "Condo", "Chalet", "Terrain", "Plex", "Commercial"]} />
              <Field label="Prix demandé" value={draft.askingPrice} onChange={(value) => update("askingPrice", value)} />
              <Field label="Numéro Centris / MLS optionnel" value={draft.mlsNumber} onChange={(value) => update("mlsNumber", value)} />
            </div>
          </Step>
        ) : null}

        {step === 1 ? (
          <Step title="Caractéristiques">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Chambres" value={draft.bedrooms} onChange={(value) => update("bedrooms", value)} />
              <Field label="Salles de bain" value={draft.bathrooms} onChange={(value) => update("bathrooms", value)} />
              <Field label="Garage" value={draft.garage} onChange={(value) => update("garage", value)} />
              <Field label="Stationnements" value={draft.parking} onChange={(value) => update("parking", value)} />
              <Field label="Piscine" value={draft.pool} onChange={(value) => update("pool", value)} />
              <Field label="Sous-sol" value={draft.basement} onChange={(value) => update("basement", value)} />
              <Field label="Foyer" value={draft.fireplace} onChange={(value) => update("fireplace", value)} />
              <Field label="Air climatisé" value={draft.airConditioning} onChange={(value) => update("airConditioning", value)} />
              <Field label="Superficie habitable" value={draft.livingArea} onChange={(value) => update("livingArea", value)} />
              <Field label="Superficie terrain" value={draft.landArea} onChange={(value) => update("landArea", value)} />
              <Field label="Année de construction" value={draft.yearBuilt} onChange={(value) => update("yearBuilt", value)} />
            </div>
          </Step>
        ) : null}

        {step === 2 ? (
          <Step title="Points forts">
            <div className="grid gap-4 md:grid-cols-2">
              <Textarea label="Rénovations" value={draft.renovations} onChange={(value) => update("renovations", value)} />
              <Textarea label="Quartier" value={draft.neighborhood} onChange={(value) => update("neighborhood", value)} />
              <Textarea label="Écoles" value={draft.schools} onChange={(value) => update("schools", value)} />
              <Textarea label="Transport" value={draft.transport} onChange={(value) => update("transport", value)} />
              <Textarea label="Cour" value={draft.yard} onChange={(value) => update("yard", value)} />
              <Textarea label="Luminosité" value={draft.brightness} onChange={(value) => update("brightness", value)} />
            </div>
            <Textarea className="mt-4" label="Particularités" value={draft.particularities} onChange={(value) => update("particularities", value)} rows={5} />
          </Step>
        ) : null}

        {step === 3 ? (
          <Step title="Style marketing">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {styles.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => update("marketingStyle", style)}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-lg border px-3 text-left text-sm font-medium transition",
                    draft.marketingStyle === style ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
                  )}
                >
                  <span className={cn("h-3.5 w-3.5 rounded-full border", draft.marketingStyle === style ? "border-white bg-teal-400 dark:border-slate-950" : "border-slate-300")} />
                  {style}
                </button>
              ))}
            </div>
          </Step>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
          <button
            type="button"
            onClick={() => (step === steps.length - 1 ? createMandate() : setStep((current) => current + 1))}
            disabled={!canContinue}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
          >
            {step === steps.length - 1 ? "Créer le mandat" : "Continuer"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange, rows = 4, className }: { label: string; value: string; onChange: (value: string) => void; rows?: number; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950" />
    </label>
  );
}
