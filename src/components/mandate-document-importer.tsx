"use client";

import type { DragEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, UploadCloud, X } from "lucide-react";

import {
  emptyExtractedMandateFields,
  type ExtractedMandateFields,
  type MandateDocumentExtractionResponse,
} from "@/lib/mandate-document-extraction";
import { cn } from "@/lib/utils";

const fieldGroups: Array<{
  title: string;
  fields: Array<{ key: keyof ExtractedMandateFields; label: string; multiline?: boolean }>;
}> = [
  {
    title: "Identification",
    fields: [
      { key: "address", label: "Adresse" },
      { key: "city", label: "Ville" },
      { key: "postalCode", label: "Code postal" },
      { key: "owners", label: "Nom des propriétaires" },
    ],
  },
  {
    title: "Cadastre et superficies",
    fields: [
      { key: "lotNumber", label: "Numéro de lot" },
      { key: "cadastre", label: "Cadastre" },
      { key: "landArea", label: "Superficie du terrain" },
      { key: "livingArea", label: "Superficie habitable" },
      { key: "yearBuilt", label: "Année de construction" },
    ],
  },
  {
    title: "Taxes et évaluation",
    fields: [
      { key: "municipalTaxes", label: "Taxes municipales" },
      { key: "schoolTaxes", label: "Taxes scolaires" },
      { key: "municipalAssessment", label: "Évaluation municipale" },
    ],
  },
  {
    title: "Caractéristiques et contraintes",
    fields: [
      { key: "zoning", label: "Zonage" },
      { key: "servitudes", label: "Servitudes", multiline: true },
      { key: "pool", label: "Piscine" },
      { key: "garage", label: "Garage" },
      { key: "importantInfo", label: "Informations importantes", multiline: true },
      { key: "missingInfo", label: "Informations manquantes", multiline: true },
    ],
  },
];

export function MandateDocumentImporter() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState<ExtractedMandateFields>(emptyExtractedMandateFields);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "extracting" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  function addFiles(nextFiles: File[]) {
    const pdfs = nextFiles.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    setFiles((current) => [...current, ...pdfs].slice(0, 8));
    setError(pdfs.length === nextFiles.length ? "" : "Seuls les fichiers PDF ont été ajoutés.");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  function updateField<K extends keyof ExtractedMandateFields>(key: K, value: ExtractedMandateFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function extractDocuments() {
    if (!files.length) {
      setError("Déposez au moins un PDF avant de lancer l’extraction.");
      return;
    }

    setStatus("extracting");
    setError("");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/extract-mandate-documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as MandateDocumentExtractionResponse & { error?: string };

      if (!response.ok) throw new Error(payload.error || "L’extraction des documents a échoué.");

      setFields(payload.fields);
      setFileNames(payload.fileNames);
      setStatus("ready");
    } catch (extractError) {
      setStatus("error");
      setError(extractError instanceof Error ? extractError.message : "L’extraction des documents a échoué.");
    }
  }

  function createMandate() {
    const id = `local-${Date.now()}`;
    const highlights = [
      fields.importantInfo ? `Informations importantes: ${fields.importantInfo}` : null,
      fields.servitudes ? `Servitudes: ${fields.servitudes}` : null,
      fields.zoning ? `Zonage: ${fields.zoning}` : null,
      fields.missingInfo ? `Informations manquantes: ${fields.missingInfo}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      id,
      address: fields.address,
      city: fields.city,
      postal_code: fields.postalCode,
      property_type: "Propriété",
      asking_price: "",
      mls_number: "",
      bedrooms: "",
      bathrooms: "",
      garage: fields.garage,
      parking: "",
      pool: fields.pool,
      basement: "",
      fireplace: "",
      air_conditioning: "",
      living_area: fields.livingArea,
      land_area: fields.landArea,
      year_built: fields.yearBuilt,
      highlights,
      marketing_style: "Professionnel",
      created_at: new Date().toISOString(),
      type: "Propriété",
      price: "",
      description: highlights,
      lot: fields.landArea,
      owners: fields.owners,
      lot_number: fields.lotNumber,
      cadastre: fields.cadastre,
      municipal_taxes: fields.municipalTaxes,
      school_taxes: fields.schoolTaxes,
      municipal_assessment: fields.municipalAssessment,
      zoning: fields.zoning,
      servitudes: fields.servitudes,
      extracted_document_names: fileNames,
      missing_info: fields.missingInfo,
      particularities: [fields.importantInfo, fields.servitudes, fields.zoning].filter(Boolean),
    };

    window.localStorage.setItem(`iacourtier-mandate-${id}`, JSON.stringify(payload));
    router.push(`/tableau-de-bord/mandats/local/${id}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Import intelligent</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Déposez les documents du mandat</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Glissez le certificat de localisation, les comptes de taxes, l’acte de vente ou la déclaration du vendeur. IACourtier extrait les informations, puis vous les validez avant création.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(event) => addFiles(Array.from(event.target.files || []))}
          />

          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-teal-400 hover:bg-white dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-teal-700"
          >
            <UploadCloud className="h-10 w-10 text-teal-600" />
            <span className="mt-4 text-base font-semibold">Glisser les PDF ici</span>
            <span className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">ou cliquez pour sélectionner plusieurs documents. Format accepté : PDF.</span>
          </label>

          {files.length ? (
            <div className="mt-5 space-y-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-teal-600" />
                    <span className="truncate">{file.name}</span>
                  </span>
                  <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}

          <button
            type="button"
            onClick={extractDocuments}
            disabled={status === "extracting" || !files.length}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            {status === "extracting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {status === "extracting" ? "Analyse des documents en cours..." : "Extraire les informations"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-premium dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Validation</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Validez les informations extraites</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Tous les champs restent modifiables. Les champs non détectés sont laissés vides.</p>
          </div>
          {status === "ready" ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-200">Prêt</span> : null}
        </div>

        <div className="mt-6 space-y-7">
          {fieldGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.title}</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {group.fields.map((field) =>
                  field.multiline ? (
                    <Textarea key={field.key} label={field.label} value={fields[field.key]} onChange={(value) => updateField(field.key, value)} />
                  ) : (
                    <Field key={field.key} label={field.label} value={fields[field.key]} onChange={(value) => updateField(field.key, value)} />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={createMandate}
          disabled={!fields.address.trim() || !fields.city.trim()}
          className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
        >
          Créer le mandat avec ces informations
        </button>
      </section>
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

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950" />
    </label>
  );
}
