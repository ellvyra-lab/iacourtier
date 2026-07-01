"use client";

import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Clipboard, Download, Heart, Loader2, Pencil, RefreshCw, Rocket } from "lucide-react";

import type { Mandat } from "@/lib/mandats";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { descriptionLengths, propertyTypes, type PropertyDescriptionForm, writingStyles } from "@/lib/property-description";
import { cn } from "@/lib/utils";

const initialForm: PropertyDescriptionForm = {
  propertyType: "Maison",
  city: "",
  address: "",
  price: "",
  constructionYear: "",
  bedrooms: "",
  bathrooms: "",
  livingArea: "",
  lotArea: "",
  garage: false,
  parking: "",
  pool: false,
  basement: false,
  fireplace: false,
  airConditioning: false,
  highlights: "",
  style: "Chaleureux",
  length: "Moyenne",
};

type GenerateResponse = {
  text: string;
  id?: string;
  saved: boolean;
};

type LinkedMandat = Mandat & {
  returnHref: string;
};

function yesNoToBoolean(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") return value;
  if (!value) return false;
  return ["oui", "true", "1", "yes", "avec", "inclus"].some((item) => value.toLowerCase().includes(item));
}

function localMandatToMandat(value: Record<string, unknown>): Mandat {
  return {
    id: String(value.id || ""),
    address: String(value.address || ""),
    city: String(value.city || ""),
    property_type: String(value.property_type || value.type || "Maison"),
    asking_price: String(value.asking_price || value.price || ""),
    mls_number: String(value.mls_number || ""),
    bedrooms: String(value.bedrooms || ""),
    bathrooms: String(value.bathrooms || ""),
    garage: String(value.garage || ""),
    parking: String(value.parking || ""),
    pool: String(value.pool || ""),
    basement: String(value.basement || ""),
    fireplace: String(value.fireplace || ""),
    air_conditioning: String(value.air_conditioning || ""),
    living_area: String(value.living_area || ""),
    land_area: String(value.land_area || value.lot || ""),
    year_built: String(value.year_built || ""),
    highlights: String(value.highlights || value.description || ""),
    marketing_style: String(value.marketing_style || "Chaleureux"),
    created_at: String(value.created_at || ""),
  };
}

export function PropertyDescriptionAssistant() {
  const searchParams = useSearchParams();
  const mandatId = searchParams.get("mandatId")?.trim();
  const source = searchParams.get("source");
  const [form, setForm] = useState<PropertyDescriptionForm>(initialForm);
  const [linkedMandat, setLinkedMandat] = useState<LinkedMandat | null>(null);
  const [generatedText, setGeneratedText] = useState("");
  const [generatedId, setGeneratedId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const canGenerate = useMemo(() => form.propertyType && form.city.trim() && form.highlights.trim(), [form]);

  useEffect(() => {
    if (!mandatId) {
      setLinkedMandat(null);
      setForm(initialForm);
      return;
    }

    let isMounted = true;

    async function loadMandat() {
      try {
        let mandat: Mandat | null = null;

        if (source === "local") {
          const stored = window.localStorage.getItem(`iacourtier-mandate-${mandatId}`);
          if (stored) mandat = localMandatToMandat(JSON.parse(stored) as Record<string, unknown>);
        }

        if (!mandat) {
          const token = await getAccessToken();
          const response = await fetch(`/api/mandats/${mandatId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (response.ok) {
            const payload = (await response.json()) as { mandat?: Mandat };
            mandat = payload.mandat ?? null;
          }
        }

        if (!mandat || !isMounted) return;

        setLinkedMandat({
          ...mandat,
          returnHref: source === "local" ? `/tableau-de-bord/mandats/local/${mandat.id}` : `/tableau-de-bord/mandats/${mandat.id}`,
        });
        setForm({
          propertyType: mandat.property_type || "Maison",
          city: mandat.city || "",
          address: mandat.address || "",
          price: mandat.asking_price || "",
          constructionYear: mandat.year_built || "",
          bedrooms: mandat.bedrooms || "",
          bathrooms: mandat.bathrooms || "",
          livingArea: mandat.living_area || "",
          lotArea: mandat.land_area || "",
          garage: yesNoToBoolean(mandat.garage),
          parking: mandat.parking || "",
          pool: yesNoToBoolean(mandat.pool),
          basement: yesNoToBoolean(mandat.basement),
          fireplace: yesNoToBoolean(mandat.fireplace),
          airConditioning: yesNoToBoolean(mandat.air_conditioning),
          highlights: mandat.highlights || "",
          style: mandat.marketing_style || "Chaleureux",
          length: "Moyenne",
        });
      } catch {
        if (isMounted) setError("Impossible de charger le mandat lié. Le formulaire reste disponible.");
      }
    }

    loadMandat();
    return () => {
      isMounted = false;
    };
  }, [mandatId, source]);

  function update<K extends keyof PropertyDescriptionForm>(key: K, value: PropertyDescriptionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function getAccessToken() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token;
    } catch {
      return undefined;
    }
  }

  async function generate() {
    if (!canGenerate) {
      setError("Ajoutez au minimum la ville et les points forts avant de générer.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setCopied(false);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...form, mandatId }),
      });

      const payload = (await response.json()) as GenerateResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "La génération a échoué.");

      setGeneratedText(payload.text);
      setGeneratedId(payload.id);
      setIsEditing(false);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "La génération a échoué.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveDescription() {
    if (generatedId) return;

    setIsSaving(true);
    setError("");

    try {
      const token = await getAccessToken();
      if (!token) {
        if (!mandatId) throw new Error("Connectez-vous pour sauvegarder dans Supabase.");

        const storageKey = `iacourtier-generated-descriptions-${mandatId}`;
        const existing = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as Array<Record<string, unknown>>;
        const id = `local-description-${Date.now()}`;
        const record = {
          id,
          mandat_id: mandatId,
          property_type: form.propertyType,
          city: form.city,
          price: form.price || null,
          generated_text: generatedText,
          created_at: new Date().toISOString(),
        };
        window.localStorage.setItem(storageKey, JSON.stringify([record, ...existing]));
        setGeneratedId(id);
        return;
      }

      const response = await fetch("/api/generated-descriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ form, generatedText, mandatId }),
      });

      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "La sauvegarde a échoué.");
      setGeneratedId(payload.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "La sauvegarde a échoué.");
    } finally {
      setIsSaving(false);
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(generatedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadText() {
    const blob = new Blob([generatedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `description-${form.city || "propriete"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <form className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-premium dark:border-slate-800 dark:bg-slate-900/76 sm:p-6" onSubmit={(event) => event.preventDefault()}>
        {linkedMandat ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-950/50">
            <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">Données utilisées par l&apos;IA</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">{linkedMandat.address}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {linkedMandat.city} · {linkedMandat.property_type || "Propriété"} · {linkedMandat.asking_price || "Prix à préciser"}
                </p>
              </div>
              <Link href={linkedMandat.returnHref} className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
                Retour au mandat
              </Link>
            </div>
            <div className="mt-4 rounded-lg border border-teal-200/70 bg-white/70 p-3 text-sm leading-6 text-teal-950 dark:border-teal-900 dark:bg-slate-950/30 dark:text-teal-100">
              Aucun formulaire manuel requis. La description sera générée à partir du dossier du mandat déjà sélectionné.
            </div>
          </div>
        ) : null}

        {!linkedMandat ? (
          <>
            <Step title="1" label="Informations générales">
              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Type de propriété" value={form.propertyType} onChange={(value) => update("propertyType", value)} options={propertyTypes} />
                <Field label="Ville" value={form.city} onChange={(value) => update("city", value)} required />
                <Field label="Adresse (facultatif)" value={form.address || ""} onChange={(value) => update("address", value)} />
                <Field label="Prix demandé" value={form.price || ""} onChange={(value) => update("price", value)} inputMode="numeric" />
                <Field label="Année de construction" value={form.constructionYear || ""} onChange={(value) => update("constructionYear", value)} inputMode="numeric" />
              </div>
            </Step>

            <Step title="2" label="Caractéristiques">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Nombre de chambres" value={form.bedrooms || ""} onChange={(value) => update("bedrooms", value)} inputMode="numeric" />
                <Field label="Nombre de salles de bain" value={form.bathrooms || ""} onChange={(value) => update("bathrooms", value)} inputMode="decimal" />
                <Field label="Superficie habitable" value={form.livingArea || ""} onChange={(value) => update("livingArea", value)} />
                <Field label="Superficie du terrain" value={form.lotArea || ""} onChange={(value) => update("lotArea", value)} />
                <Field label="Stationnements" value={form.parking || ""} onChange={(value) => update("parking", value)} inputMode="numeric" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["garage", "Garage"],
                  ["pool", "Piscine"],
                  ["basement", "Sous-sol"],
                  ["fireplace", "Foyer"],
                  ["airConditioning", "Air climatisé"],
                ].map(([key, label]) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={Boolean(form[key as keyof PropertyDescriptionForm])}
                    onChange={(checked) => update(key as keyof PropertyDescriptionForm, checked as never)}
                  />
                ))}
              </div>
            </Step>

            <Step title="3" label="Points forts">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Détails à mettre en valeur</span>
                <textarea
                  value={form.highlights}
                  onChange={(event) => update("highlights", event.target.value)}
                  rows={7}
                  placeholder="Décrivez les rénovations, les avantages, le quartier, la luminosité, la cour, les écoles, les transports, etc."
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                />
              </label>
            </Step>

            <Step title="4" label="Style d'écriture">
              <RadioGroup value={form.style} options={writingStyles} onChange={(value) => update("style", value)} />
            </Step>

            <Step title="5" label="Longueur">
              <RadioGroup value={form.length} options={descriptionLengths} onChange={(value) => update("length", value)} />
            </Step>
          </>
        ) : null}

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}

        <button
          type="button"
          onClick={generate}
          disabled={isGenerating}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {linkedMandat ? "Générer avec le dossier" : "Générer la description"}
        </button>
      </form>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        {isGenerating ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-premium dark:border-slate-800 dark:bg-slate-900/76">
            <div className="relative mb-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="animate-sheen after:absolute after:inset-y-0 after:w-1/2 after:bg-gradient-to-r after:from-transparent after:via-teal-400 after:to-transparent" />
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
              Votre Assistant IA rédige votre description...
            </div>
          </div>
        ) : generatedText ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-premium dark:border-slate-800 dark:bg-slate-900/76">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Description générée</p>
                <h2 className="text-xl font-semibold">Version prête à publier</h2>
              </div>
              {generatedId ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-200">
                  <Check className="h-3.5 w-3.5" />
                  Sauvegardée
                </span>
              ) : null}
            </div>

            {isEditing ? (
              <textarea value={generatedText} onChange={(event) => setGeneratedText(event.target.value)} rows={14} className="mt-5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-7 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950" />
            ) : (
              <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{generatedText}</div>
            )}

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <ActionButton icon={copied ? Check : Clipboard} label={copied ? "Copié" : "Copier"} onClick={copyText} />
              <ActionButton icon={RefreshCw} label="Régénérer" onClick={generate} />
              <ActionButton icon={Heart} label={generatedId ? "Sauvegardée" : isSaving ? "Sauvegarde..." : "Sauvegarder"} onClick={saveDescription} />
              <ActionButton icon={Pencil} label={isEditing ? "Terminer" : "Modifier"} onClick={() => setIsEditing((value) => !value)} />
              <button onClick={downloadText} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 sm:col-span-2">
                <Download className="h-4 w-4" />
                Télécharger (.txt)
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/72 p-6 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900/56 dark:text-slate-300">
            La description apparaîtra ici dès que l&apos;assistant aura terminé la rédaction.
          </div>
        )}
      </aside>
    </div>
  );
}

function Step({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">{title}</span>
        <h2 className="text-lg font-semibold">{label}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, required, inputMode }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        inputMode={inputMode}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cn("flex h-11 items-center justify-between rounded-lg border px-3 text-sm font-medium transition", checked ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900")}>
      {label}
      <span className={cn("h-4 w-4 rounded-full border", checked ? "border-teal-600 bg-teal-600" : "border-slate-300")} />
    </button>
  );
}

function RadioGroup({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={cn("flex h-11 items-center gap-3 rounded-lg border px-3 text-left text-sm font-medium transition", value === option ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900")}>
          <span className={cn("h-3.5 w-3.5 rounded-full border", value === option ? "border-white bg-teal-400 dark:border-slate-950" : "border-slate-300")} />
          {option}
        </button>
      ))}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
