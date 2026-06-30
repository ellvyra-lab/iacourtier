"use client";

import type { ElementType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Copy,
  Database,
  FileUp,
  Link as LinkIcon,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import {
  createProspectingActions,
  manualProspects,
  parseProspectsCsv,
  prospectingCategories,
  type ProspectingPriority,
  type ProspectRecord,
} from "@/lib/prospecting";
import type { GovernmentSourceRecord, GovernmentSourceType } from "@/lib/prospecting/government-source";
import { cn } from "@/lib/utils";

const priorities: Array<ProspectingPriority | "Toutes"> = ["Toutes", "Élevée", "Moyenne", "Faible"];

type SourceForm = {
  name: string;
  province: string;
  city: string;
  organization: string;
  url: string;
  sourceType: GovernmentSourceType;
  updateFrequency: string;
};

const defaultSourceForm: SourceForm = {
  name: "",
  province: "Québec",
  city: "",
  organization: "",
  url: "",
  sourceType: "CSV",
  updateFrequency: "nightly",
};

export function ProspectionRadar() {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [syncedProspects, setSyncedProspects] = useState<ProspectRecord[]>([]);
  const [csvProspects, setCsvProspects] = useState<ProspectRecord[]>([]);
  const [sources, setSources] = useState<GovernmentSourceRecord[]>([]);
  const [sourceForm, setSourceForm] = useState<SourceForm>(defaultSourceForm);
  const [sourceStatus, setSourceStatus] = useState("");
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [syncingSourceId, setSyncingSourceId] = useState("");
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [city, setCity] = useState("Toutes");
  const [propertyType, setPropertyType] = useState("Tous");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("Toutes");
  const [category, setCategory] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(manualProspects[0]?.id || "");
  const [copied, setCopied] = useState("");
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    void refreshRadarData();
  }, []);

  const opportunities = useMemo(() => {
    const fallbackDemo = syncedProspects.length || csvProspects.length ? [] : manualProspects;
    return [...syncedProspects, ...csvProspects, ...fallbackDemo];
  }, [csvProspects, syncedProspects]);

  const cities = useMemo(() => ["Toutes", ...Array.from(new Set(opportunities.map((item) => item.city))).sort()], [opportunities]);
  const propertyTypes = useMemo(() => ["Tous", ...Array.from(new Set(opportunities.map((item) => item.propertyType))).sort()], [opportunities]);
  const categories = useMemo(() => ["Toutes", ...prospectingCategories], []);

  const filtered = useMemo(
    () =>
      opportunities
        .filter((item) => city === "Toutes" || item.city === city)
        .filter((item) => propertyType === "Tous" || item.propertyType === propertyType)
        .filter((item) => priority === "Toutes" || item.priority === priority)
        .filter((item) => category === "Toutes" || item.category === category)
        .filter((item) => {
          const normalized = query.trim().toLowerCase();
          if (!normalized) return true;
          return [item.address, item.city, item.propertyType, item.category, item.reason, item.ownerName].join(" ").toLowerCase().includes(normalized);
        })
        .sort((a, b) => b.opportunityScore - a.opportunityScore),
    [category, city, opportunities, priority, propertyType, query],
  );

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || opportunities[0];
  const averageScore = Math.round(filtered.reduce((total, item) => total + item.opportunityScore, 0) / Math.max(filtered.length, 1));
  const highPriorityCount = filtered.filter((item) => item.priority === "Élevée").length;

  async function refreshRadarData() {
    setIsLoadingSources(true);
    try {
      const [sourcesResponse, opportunitiesResponse] = await Promise.all([fetch("/api/radar/sources"), fetch("/api/radar/opportunities?limit=300")]);
      const sourcesPayload = (await sourcesResponse.json()) as { sources?: GovernmentSourceRecord[]; error?: string };
      const opportunitiesPayload = (await opportunitiesResponse.json()) as { opportunities?: ProspectRecord[]; error?: string };

      if (sourcesResponse.ok) setSources(sourcesPayload.sources ?? []);
      if (opportunitiesResponse.ok) {
        const prospects = opportunitiesPayload.opportunities ?? [];
        setSyncedProspects(prospects);
        setSelectedId((current) => current || prospects[0]?.id || manualProspects[0]?.id || "");
      }
      if (!sourcesResponse.ok || !opportunitiesResponse.ok) {
        setSourceStatus(sourcesPayload.error || opportunitiesPayload.error || "Le Radar local n'a pas pu être chargé.");
      }
    } catch {
      setSourceStatus("Le Radar local n'a pas pu être chargé. Les données démo restent disponibles.");
    } finally {
      setIsLoadingSources(false);
    }
  }

  async function addSource() {
    if (!sourceForm.name.trim() || !sourceForm.url.trim()) {
      setSourceStatus("Ajoutez un nom et une URL publique pour créer la source.");
      return;
    }

    setSourceStatus("Ajout de la source...");
    try {
      const response = await fetch("/api/radar/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceForm),
      });
      const payload = (await response.json()) as { source?: GovernmentSourceRecord; error?: string };
      if (!response.ok) throw new Error(payload.error || "La source n'a pas pu être ajoutée.");

      setSources((current) => [payload.source as GovernmentSourceRecord, ...current]);
      setSourceForm(defaultSourceForm);
      setSourceStatus("Source ajoutée. Vous pouvez lancer la synchronisation.");
    } catch (error) {
      setSourceStatus(error instanceof Error ? error.message : "La source n'a pas pu être ajoutée.");
    }
  }

  async function syncAllSources() {
    setIsSyncingAll(true);
    setSourceStatus("Synchronisation de toutes les sources actives...");
    try {
      const response = await fetch("/api/radar/sync", { method: "POST" });
      const payload = (await response.json()) as { syncedSources?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "La synchronisation globale a échoué.");
      setSourceStatus(`${payload.syncedSources ?? 0} source${payload.syncedSources === 1 ? "" : "s"} synchronisée${payload.syncedSources === 1 ? "" : "s"}.`);
      await refreshRadarData();
    } catch (error) {
      setSourceStatus(error instanceof Error ? error.message : "La synchronisation globale a échoué.");
    } finally {
      setIsSyncingAll(false);
    }
  }

  async function syncSource(sourceId: string) {
    setSyncingSourceId(sourceId);
    setSourceStatus("Synchronisation de la source...");
    try {
      const response = await fetch(`/api/radar/sources/${sourceId}/sync`, { method: "POST" });
      const payload = (await response.json()) as { result?: { recordCount: number; error: string | null }; error?: string };
      if (!response.ok) throw new Error(payload.error || payload.result?.error || "La synchronisation a échoué.");
      setSourceStatus(`${payload.result?.recordCount ?? 0} opportunité${payload.result?.recordCount === 1 ? "" : "s"} mise${payload.result?.recordCount === 1 ? "" : "s"} à jour.`);
      await refreshRadarData();
    } catch (error) {
      setSourceStatus(error instanceof Error ? error.message : "La synchronisation a échoué.");
    } finally {
      setSyncingSourceId("");
    }
  }

  function resetFilters() {
    setCity("Toutes");
    setPropertyType("Tous");
    setPriority("Toutes");
    setCategory("Toutes");
    setQuery("");
  }

  async function copyAction(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1400);
  }

  async function importCsv(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportStatus("Le format accepté est CSV.");
      return;
    }

    try {
      const text = await file.text();
      const prospects = parseProspectsCsv(text, file.name);
      setCsvProspects((current) => [...prospects, ...current]);
      setSelectedId(prospects[0]?.id || selectedId);
      setImportStatus(`${prospects.length} prospect${prospects.length > 1 ? "s" : ""} importé${prospects.length > 1 ? "s" : ""} depuis ${file.name}.`);
    } catch {
      setImportStatus("Le CSV n'a pas pu être lu. Vérifiez les colonnes Adresse, Ville, Nom, Téléphone, Courriel, Catégorie et Notes.");
    }
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px] lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200">
              <Sparkles className="h-3.5 w-3.5" />
              Moteur d&apos;acquisition automatique
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Radar de prospection IA</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Le Radar travaille maintenant à partir d&apos;une base locale synchronisée. Les sources publiques configurées sont analysées automatiquement, dédupliquées, puis transformées en opportunités de prospection.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <Metric label="Occasions" value={filtered.length.toString()} />
            <Metric label="Score moyen" value={averageScore.toString()} />
            <Metric label="Priorité élevée" value={highPriorityCount.toString()} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
              <Database className="h-4 w-4" />
              Sources gouvernementales
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Acquisition automatique des données publiques</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Ajoutez les fichiers publics CSV, XML ou API JSON. IACourtier les synchronise dans sa base locale; les recherches Radar ne téléchargent plus les données en temps réel.
            </p>
          </div>
          <button
            type="button"
            onClick={syncAllSources}
            disabled={isSyncingAll || !sources.some((source) => source.active)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            {isSyncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Synchroniser maintenant
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_.7fr_.7fr_.8fr_120px]">
          <TextInput label="Nom" value={sourceForm.name} placeholder="Rôle foncier Laval" onChange={(value) => setSourceForm((current) => ({ ...current, name: value }))} />
          <TextInput label="Ville ciblée" value={sourceForm.city} placeholder="Laval" onChange={(value) => setSourceForm((current) => ({ ...current, city: value }))} />
          <TextInput label="Organisme" value={sourceForm.organization} placeholder="Données Québec" onChange={(value) => setSourceForm((current) => ({ ...current, organization: value }))} />
          <TextInput label="URL publique" value={sourceForm.url} placeholder="https://.../donnees.csv" onChange={(value) => setSourceForm((current) => ({ ...current, url: value }))} />
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Type</span>
            <select
              value={sourceForm.sourceType}
              onChange={(event) => setSourceForm((current) => ({ ...current, sourceType: event.target.value as GovernmentSourceType }))}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="CSV">CSV</option>
              <option value="XML">XML</option>
              <option value="API">API</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={addSource}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <CheckCircle2 className="h-4 w-4" />
            Ajouter la source
          </button>
          {sourceStatus ? <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{sourceStatus}</p> : null}
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-[1.2fr_.7fr_.6fr_.6fr_.7fr_150px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
            <span>Source</span>
            <span>Dernière sync</span>
            <span>Enregistrements</span>
            <span>Statut</span>
            <span>Dernière erreur</span>
            <span className="text-right">Action</span>
          </div>
          {isLoadingSources ? (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des sources...
            </div>
          ) : sources.length ? (
            sources.map((source) => (
              <div key={source.id} className="grid grid-cols-[1.2fr_.7fr_.6fr_.6fr_.7fr_150px] items-center gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{source.name}</p>
                  <p className="truncate text-xs text-slate-500">{source.organization || "Organisme non précisé"} · {source.source_type}</p>
                </div>
                <span className="text-slate-600 dark:text-slate-300">{source.last_synced_at ? formatDate(source.last_synced_at) : "Jamais"}</span>
                <span>{source.record_count ?? 0}</span>
                <SourceStatusBadge status={source.status || "pending"} active={source.active} />
                <span className="truncate text-xs text-slate-500">{source.last_error || "Aucune"}</span>
                <button
                  type="button"
                  onClick={() => syncSource(source.id)}
                  disabled={syncingSourceId === source.id}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
                >
                  {syncingSourceId === source.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Sync
                </button>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-slate-500">Aucune source configurée pour l&apos;instant.</div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 shadow-sm dark:border-teal-900 dark:bg-teal-950/24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-800 dark:text-teal-100">
              <FileUp className="h-4 w-4" />
              Import manuel CSV
            </div>
            <p className="mt-1 text-sm leading-6 text-teal-900/75 dark:text-teal-100/75">
              Gardez cette option pour les listes privées ou ponctuelles. Colonnes acceptées : Adresse, Ville, Nom, Téléphone, Courriel, Catégorie, Notes.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => event.target.files?.[0] && importCsv(event.target.files[0])} />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
            >
              <FileUp className="h-4 w-4" />
              Importer une liste CSV
            </button>
            {importStatus ? <span className="text-sm font-medium text-teal-800 dark:text-teal-100">{importStatus}</span> : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une adresse, une ville, une catégorie..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:w-[720px]">
            <FilterSelect label="Ville" value={city} options={cities} onChange={setCity} />
            <FilterSelect label="Type" value={propertyType} options={propertyTypes} onChange={setPropertyType} />
            <FilterSelect label="Priorité" value={priority} options={priorities} onChange={(value) => setPriority(value as typeof priority)} />
            <FilterSelect label="Catégorie" value={category} options={categories} onChange={setCategory} />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <SlidersHorizontal className="h-4 w-4" />
            {filtered.length} opportunité{filtered.length > 1 ? "s" : ""} détectée{filtered.length > 1 ? "s" : ""}
          </div>

          {filtered.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} active={selected.id === opportunity.id} onSelect={() => setSelectedId(opportunity.id)} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/72 dark:text-slate-400">
              Aucune opportunité ne correspond aux filtres actuels.
            </div>
          )}
        </section>

        <ActionsPanel opportunity={selected} copied={copied} onCopy={copyAction} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function TextInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

function SourceStatusBadge({ status, active }: { status: string; active: boolean }) {
  const label = active ? status : "inactive";
  const className =
    label === "success"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900"
      : label === "error"
        ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900"
        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";

  return <span className={cn("w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1", className)}>{label}</span>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label}: {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function OpportunityCard({ opportunity, active, onSelect }: { opportunity: ProspectRecord; active: boolean; onSelect: () => void }) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-5 shadow-sm transition dark:bg-slate-900/72",
        active ? "border-teal-300 ring-4 ring-teal-500/10 dark:border-teal-800" : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={opportunity.priority} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{opportunity.category}</span>
          </div>
          <h2 className="mt-3 truncate text-lg font-semibold tracking-tight">{opportunity.address}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Building2 className="h-4 w-4" />
            {opportunity.city} · {opportunity.propertyType}
          </p>
        </div>
        <ScoreRing score={opportunity.opportunityScore} />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{opportunity.reason}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[`Source : ${sourceLabel(opportunity.source)}`, opportunity.lastUpdated ? `MAJ : ${formatDate(opportunity.lastUpdated)}` : "", opportunity.contactName ? `Contact : ${opportunity.contactName}` : "", opportunity.email || opportunity.phone || ""].filter(Boolean).map((signal) => (
          <span key={signal} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {signal}
          </span>
        ))}
      </div>

      {opportunity.url ? (
        <a href={opportunity.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-teal-700 hover:underline dark:text-teal-300">
          <LinkIcon className="h-3.5 w-3.5" />
          Voir la source
        </a>
      ) : null}

      <button
        type="button"
        onClick={onSelect}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
      >
        Voir les actions IA
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? "text-emerald-600" : score >= 75 ? "text-teal-600" : "text-amber-600";

  return (
    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70">
      <span className={cn("text-lg font-bold", color)}>{score}</span>
      <span className="text-[10px] font-medium text-slate-400">/100</span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: ProspectingPriority }) {
  const className =
    priority === "Élevée"
      ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900"
      : priority === "Moyenne"
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900"
        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";

  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", className)}>{priority}</span>;
}

function sourceLabel(source: ProspectRecord["source"]) {
  const labels: Record<ProspectRecord["source"], string> = {
    manual: "Manuel",
    csv: "CSV",
    expired: "Expirées",
    judicial: "Judiciaire",
    municipal: "Municipal",
    government: "Gouvernement / Données Québec",
  };

  return labels[source];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function ActionsPanel({ opportunity, copied, onCopy }: { opportunity: ProspectRecord; copied: string; onCopy: (label: string, value: string) => void }) {
  const actions = createProspectingActions(opportunity);
  const actionItems = [
    { label: "Premier message Facebook", icon: MessageCircle, value: actions.facebook },
    { label: "Premier courriel", icon: Mail, value: actions.email },
    { label: "Premier appel", icon: Phone, value: actions.call },
    { label: "Message texte", icon: MessageCircle, value: actions.sms },
    { label: "Relance après 7 jours", icon: RotateCcw, value: actions.followUp7 },
    { label: "Relance après 30 jours", icon: RotateCcw, value: actions.followUp30 },
  ];

  return (
    <aside className="xl:sticky xl:top-8 xl:self-start">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-premium dark:border-slate-800 dark:bg-slate-900/76">
        <div className="border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Actions IA</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{opportunity.address}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {opportunity.category} · Score {opportunity.opportunityScore}/100 · {sourceLabel(opportunity.source)}
          </p>
        </div>

        <div className="space-y-4 p-5">
          {actionItems.map((item) => (
            <ActionBlock key={item.label} label={item.label} value={item.value} copied={copied === item.label} icon={item.icon} onCopy={() => onCopy(item.label, item.value)} />
          ))}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="text-sm font-semibold">Objections probables</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {actions.objections.map((objection) => (
                <li key={objection}>- {objection}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900 dark:bg-teal-950/30">
            <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-100">Réponses suggérées</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-teal-900/80 dark:text-teal-100/80">
              {actions.responses.map((response) => (
                <li key={response}>- {response}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ActionBlock({
  label,
  value,
  copied,
  icon: Icon,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  icon: ElementType;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/45">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-teal-600" />
          {label}
        </h3>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{value}</p>
    </div>
  );
}
