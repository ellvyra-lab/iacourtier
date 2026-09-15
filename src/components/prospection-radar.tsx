"use client";

import type { ElementType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Copy,
  Database,
  FileUp,
  Link as LinkIcon,
  Lock,
  Loader2,
  Mail,
  MapPin,
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
  parseRoleEvaluationFile,
  prospectingCommunicationStyles,
  prospectingCategories,
  type ProspectingCommunicationStyle,
  type ProspectingPriority,
  type ProspectRecord,
} from "@/lib/prospecting";
import type { GovernmentSourceRecord, GovernmentSourceType } from "@/lib/prospecting/government-source";
import {
  canUnlockRadarOpportunity,
  getCurrentRadarUserId,
  getMaskedAvailableOpportunities,
  getRadarQuotaState,
  getUnlockedOpportunities,
  isUnlimitedRadarUser,
  unlockBestRadarOpportunity,
  type MaskedRadarOpportunity,
  type RadarQuotaState,
} from "@/lib/radar-quota";
import { coachSalesCall, type CallCoachSuggestion } from "@/lib/sales-intelligence";
import { createSellerProspectFromRadar } from "@/lib/sonia-beta";
import { cn } from "@/lib/utils";
import { VoiceDictationButton } from "@/components/voice-dictation-button";

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

type SmartFilters = {
  propertyClass: "Tous" | "Maisons" | "Plex" | "Condos";
  minValue: string;
  maxYear: string;
  minLandArea: string;
  minOwnerYears: string;
  sector: string;
  minScore: string;
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

const defaultSmartFilters: SmartFilters = {
  propertyClass: "Tous",
  minValue: "",
  maxYear: "",
  minLandArea: "",
  minOwnerYears: "",
  sector: "",
  minScore: "",
};

const RADAR_CSV_STORAGE_KEY = "iacourtier_radar_csv_prospects";

function loadStoredCsvProspects(): ProspectRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RADAR_CSV_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredCsvProspects(prospects: ProspectRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RADAR_CSV_STORAGE_KEY, JSON.stringify(prospects));
}

export function ProspectionRadar() {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const roleXmlInputRef = useRef<HTMLInputElement>(null);
  const radarUserId = getCurrentRadarUserId();
  const [syncedProspects, setSyncedProspects] = useState<ProspectRecord[]>([]);
  const [csvProspects, setCsvProspects] = useState<ProspectRecord[]>([]);
  const [roleEvaluationProspects, setRoleEvaluationProspects] = useState<ProspectRecord[]>([]);
  const [sources, setSources] = useState<GovernmentSourceRecord[]>([]);
  const [sourceForm, setSourceForm] = useState<SourceForm>(defaultSourceForm);
  const [sourceStatus, setSourceStatus] = useState("");
  const [sourceAuthRequired, setSourceAuthRequired] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [syncingSourceId, setSyncingSourceId] = useState("");
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [city, setCity] = useState("Toutes");
  const [propertyType, setPropertyType] = useState("Tous");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("Toutes");
  const [category, setCategory] = useState("Toutes");
  const [smartFilters, setSmartFilters] = useState<SmartFilters>(defaultSmartFilters);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(manualProspects[0]?.id || "");
  const [copied, setCopied] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState<ProspectingCommunicationStyle>("Québécois naturel");
  const [importStatus, setImportStatus] = useState("");
  const [pendingCsv, setPendingCsv] = useState<{ text: string; fileName: string; totalRows: number } | null>(null);
  const [listCity, setListCity] = useState("");
  const [roleImportStatus, setRoleImportStatus] = useState("");
  const [isImportingRoleXml, setIsImportingRoleXml] = useState(false);
  const [quotaState, setQuotaState] = useState<RadarQuotaState | null>(null);
  const [unlockStatus, setUnlockStatus] = useState("");
  const [reachabilityProspectId, setReachabilityProspectId] = useState("");

  useEffect(() => {
    setQuotaState(getRadarQuotaState(radarUserId));
    setCsvProspects(loadStoredCsvProspects());
    void refreshRadarData();
  }, [radarUserId]);

  const opportunities = useMemo(() => {
    const fallbackDemo = syncedProspects.length || csvProspects.length || roleEvaluationProspects.length ? [] : manualProspects;
    return [...roleEvaluationProspects, ...syncedProspects, ...csvProspects, ...fallbackDemo];
  }, [csvProspects, roleEvaluationProspects, syncedProspects]);

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
        .filter((item) => matchesSmartFilters(item, smartFilters))
        .filter((item) => {
          const normalized = query.trim().toLowerCase();
          if (!normalized) return true;
          return [item.address, item.city, item.propertyType, item.category, item.reason, item.ownerName].join(" ").toLowerCase().includes(normalized);
        })
        .sort((a, b) => b.opportunityScore - a.opportunityScore),
    [category, city, opportunities, priority, propertyType, query, smartFilters],
  );

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || opportunities[0];
  const averageScore = Math.round(filtered.reduce((total, item) => total + item.opportunityScore, 0) / Math.max(filtered.length, 1));
  const highPriorityCount = filtered.filter((item) => String(item.priority).toLowerCase().includes("lev")).length;

  const unlockedRadarOpportunities = useMemo(() => (quotaState ? getUnlockedOpportunities(radarUserId, filtered, quotaState) : []), [filtered, quotaState, radarUserId]);
  const maskedRadarOpportunities = useMemo(() => (quotaState ? getMaskedAvailableOpportunities(radarUserId, filtered, quotaState).slice(0, 8) : []), [filtered, quotaState, radarUserId]);
  const radarQuota = quotaState ? canUnlockRadarOpportunity(radarUserId) : null;
  const isUnlimitedRadar = quotaState ? isUnlimitedRadarUser(quotaState.subscription) : false;
  const visibleRadarOpportunities = useMemo(() => {
    if (isUnlimitedRadar) return filtered;

    const merged = new Map<string, ProspectRecord>();
    filtered.filter((item) => item.source === "csv").forEach((item) => merged.set(item.id, item));
    unlockedRadarOpportunities.forEach((item) => merged.set(item.id, item));

    return Array.from(merged.values()).sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [filtered, isUnlimitedRadar, unlockedRadarOpportunities]);
  const selectedVisible = visibleRadarOpportunities.find((item) => item.id === selectedId) || visibleRadarOpportunities[0];
  const selectedReachabilityProspect = opportunities.find((item) => item.id === reachabilityProspectId) || null;
  const unlockedAverageScore = Math.round(unlockedRadarOpportunities.reduce((total, item) => total + item.opportunityScore, 0) / Math.max(unlockedRadarOpportunities.length, 1));
  const unlockedHighPriorityCount = unlockedRadarOpportunities.filter((item) => String(item.priority).toLowerCase().includes("lev")).length;

  function unlockOpportunity() {
    const result = unlockBestRadarOpportunity(radarUserId, filtered, city);
    setQuotaState(result.state);
    if (result.ok) {
      setSelectedId(result.opportunity.id);
      setUnlockStatus("Opportunité débloquée et réservée exclusivement pour vous.");
    } else {
      setUnlockStatus(result.reason);
    }
  }

  async function refreshRadarData() {
    setIsLoadingSources(true);
    try {
      const [sourcesResponse, opportunitiesResponse] = await Promise.all([fetch("/api/radar/sources"), fetch("/api/radar/opportunities?limit=300")]);
      const sourcesPayload = (await sourcesResponse.json()) as { sources?: GovernmentSourceRecord[]; error?: string };
      const opportunitiesPayload = (await opportunitiesResponse.json()) as { opportunities?: ProspectRecord[]; error?: string };
      const adminAccess = isUnlimitedRadarUser(getRadarQuotaState(radarUserId).subscription);
      const authRequired = (sourcesResponse.status === 401 || opportunitiesResponse.status === 401) && !adminAccess;

      setSourceAuthRequired(authRequired);

      if (sourcesResponse.ok) setSources(sourcesPayload.sources ?? []);
      if (opportunitiesResponse.ok) {
        const prospects = opportunitiesPayload.opportunities ?? [];
        setSyncedProspects(prospects);
        setSelectedId((current) => current || prospects[0]?.id || manualProspects[0]?.id || "");
      }
      if (authRequired) {
        setSources([]);
        setSyncedProspects([]);
        setSourceStatus("");
      } else if (!sourcesResponse.ok || !opportunitiesResponse.ok) {
        setSourceStatus(sourcesPayload.error || opportunitiesPayload.error || "Le Radar local n'a pas pu être chargé.");
      }
    } catch {
      setSourceStatus("Le Radar local n'a pas pu être chargé. Les données démo restent disponibles.");
    } finally {
      setIsLoadingSources(false);
    }
  }

  async function addSource() {
    if (sourceAuthRequired) {
      setSourceStatus("Connectez-vous pour ajouter une source gouvernementale.");
      return;
    }

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
    if (sourceAuthRequired) {
      setSourceStatus("Connectez-vous pour synchroniser les sources gouvernementales.");
      return;
    }

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
    if (sourceAuthRequired) {
      setSourceStatus("Connectez-vous pour synchroniser cette source.");
      return;
    }

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
    setSmartFilters(defaultSmartFilters);
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

    const text = await file.text();
    try {
      completeCsvImport(parseProspectsCsv(text, file.name), file.name);
    } catch (error) {
      if (error instanceof Error && error.message === "CSV_CITY_REQUIRED") {
        setPendingCsv({ text, fileName: file.name, totalRows: countCsvDataRows(text) });
        setListCity("");
        setImportStatus("");
        return;
      }
      setImportStatus(error instanceof Error ? error.message : "Le CSV n'a pas pu être lu.");
    }
  }

  function continueCsvImport() {
    if (!pendingCsv || !listCity.trim()) {
      setImportStatus("La ville de la liste est obligatoire.");
      return;
    }

    try {
      completeCsvImport(parseProspectsCsv(pendingCsv.text, pendingCsv.fileName, listCity), pendingCsv.fileName);
      setPendingCsv(null);
      setListCity("");
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Le CSV n'a pas pu être importé.");
    }
  }

  function completeCsvImport(result: ReturnType<typeof parseProspectsCsv>, fileName: string) {
    const nextCsvProspects = dedupeProspects([...result.prospects, ...csvProspects]);
    setCsvProspects(nextCsvProspects);
    saveStoredCsvProspects(nextCsvProspects);
    setSelectedId(result.prospects[0]?.id || selectedId);
    if (result.prospects[0]?.id) setReachabilityProspectId(result.prospects[0].id);

    const errorSummary = result.errors.length ? ` Erreurs : ${result.errors.join(" ")}` : " Erreurs : aucune.";
    setImportStatus(
      `Lignes détectées : ${result.totalRows}. Prospects importés : ${result.prospects.length}. Lignes ignorées : ${result.ignoredRows}.${errorSummary} Fichier : ${fileName}.`,
    );
  }

  async function importRoleEvaluationXml(file: File) {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xml")) {
      setRoleImportStatus("Le format accepté pour cette version est XML.");
      return;
    }

    setIsImportingRoleXml(true);
    setRoleImportStatus(`Lecture de ${file.name}...`);

    try {
      const prospects = await parseRoleEvaluationFile(file, {
        city: sourceForm.city || "",
        sourceName: file.name,
        limit: 5000,
        onProgress: ({ parsed, percent }) => {
          setRoleImportStatus(`Analyse du rôle d'évaluation... ${parsed} immeuble${parsed > 1 ? "s" : ""} détecté${parsed > 1 ? "s" : ""}${percent !== undefined ? ` · ${percent}%` : ""}`);
        },
      });
      setRoleEvaluationProspects((current) => dedupeProspects([...prospects, ...current]));
      setSelectedId(prospects[0]?.id || selectedId);
      setRoleImportStatus(`${prospects.length} immeuble${prospects.length > 1 ? "s" : ""} importé${prospects.length > 1 ? "s" : ""} depuis ${file.name}.`);
    } catch (error) {
      setRoleImportStatus(error instanceof Error ? error.message : "Le rôle d'évaluation XML n'a pas pu être lu.");
    } finally {
      setIsImportingRoleXml(false);
    }
  }

  function openReachabilityPanel(prospectId: string) {
    setReachabilityProspectId(prospectId);
    setSelectedId(prospectId);
    window.setTimeout(() => document.getElementById("radar-reachability")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function updateProspectLocal(prospectId: string, patch: Partial<ProspectRecord>) {
    const update = (items: ProspectRecord[]) => items.map((item) => (item.id === prospectId ? { ...item, ...patch } : item));
    const nextCsvProspects = update(csvProspects);
    setCsvProspects(nextCsvProspects);
    saveStoredCsvProspects(nextCsvProspects);
    setRoleEvaluationProspects((current) => update(current));
    setSyncedProspects((current) => update(current));
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

      <section className="rounded-lg border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
              <Lock className="h-4 w-4" />
              {isUnlimitedRadar ? "Mode Sonia Beta — accès illimité" : "Distribution exclusive Radar"}
            </p>
            {isUnlimitedRadar ? (
              <>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-teal-950 dark:text-teal-50">Accès complet au Radar pour tester le produit.</h2>
                <p className="mt-2 text-sm leading-6 text-teal-900/75 dark:text-teal-100/75">
                  Rôle {radarQuota?.subscription.role ?? "sonia_beta"} : aucun quota, toutes les opportunités visibles, sources et synchronisation accessibles.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-teal-950 dark:text-teal-50">
                  Il vous reste {radarQuota?.remaining ?? 0} opportunité{(radarQuota?.remaining ?? 0) > 1 ? "s" : ""} Radar cette semaine.
                </h2>
                <p className="mt-2 text-sm leading-6 text-teal-900/75 dark:text-teal-100/75">
                  Plan {radarQuota?.subscription.plan ?? "founder"} : {radarQuota?.subscription.weeklyRadarLimit ?? 25} opportunités par semaine. Une opportunité débloquée est réservée pour vous et retirée de la distribution.
                </p>
              </>
            )}
            <div className="mt-4 grid max-w-xl grid-cols-3 gap-3">
              <Metric label="Débloquées" value={unlockedRadarOpportunities.length.toString()} />
              <Metric label="Score moyen" value={unlockedAverageScore.toString()} />
              <Metric label="Priorité élevée" value={unlockedHighPriorityCount.toString()} />
            </div>
            {unlockStatus ? <p className="mt-3 text-sm font-semibold text-teal-900 dark:text-teal-100">{unlockStatus}</p> : null}
          </div>
          {!isUnlimitedRadar ? (
            <button
              type="button"
              onClick={unlockOpportunity}
              disabled={!radarQuota?.canUnlock || !maskedRadarOpportunities.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
            >
              <Lock className="h-4 w-4" />
              Débloquer une opportunité
            </button>
          ) : null}
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
            disabled={sourceAuthRequired || isSyncingAll || !sources.some((source) => source.active)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            {isSyncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Synchroniser maintenant
          </button>
        </div>

        {sourceAuthRequired ? <SourceAuthNotice /> : null}

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
            disabled={sourceAuthRequired}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <CheckCircle2 className="h-4 w-4" />
            Ajouter la source
          </button>
          {sourceStatus ? <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{sourceStatus}</p> : null}
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-[1.2fr_.7fr_.75fr_.55fr_.8fr_150px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
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
              <div key={source.id} className="grid grid-cols-[1.2fr_.7fr_.75fr_.55fr_.8fr_150px] items-center gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
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
                  disabled={sourceAuthRequired || syncingSourceId === source.id}
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

      <section className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-100">
              <Database className="h-4 w-4" />
              Importer un rôle d&apos;évaluation XML
            </div>
            <p className="mt-1 text-sm leading-6 text-indigo-900/75 dark:text-indigo-100/75">
              Déposez un fichier municipal de rôle d&apos;évaluation, comme RL66023_2026.xml. IACourtier extrait les immeubles, calcule un score et évite les doublons avec un lead_hash.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input ref={roleXmlInputRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(event) => event.target.files?.[0] && importRoleEvaluationXml(event.target.files[0])} />
            <button
              type="button"
              onClick={() => roleXmlInputRef.current?.click()}
              disabled={isImportingRoleXml}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              {isImportingRoleXml ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {isImportingRoleXml ? "Import en cours..." : "Importer le XML"}
            </button>
          </div>
        </div>
        {roleImportStatus ? <p className="mt-3 text-sm font-medium text-indigo-900 dark:text-indigo-100">{roleImportStatus}</p> : null}
      </section>

      <section className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 shadow-sm dark:border-teal-900 dark:bg-teal-950/24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-800 dark:text-teal-100">
              <FileUp className="h-4 w-4" />
              Import manuel CSV
            </div>
            <p className="mt-1 text-sm leading-6 text-teal-900/75 dark:text-teal-100/75">
              Gardez cette option pour les listes privées ou ponctuelles. Seule l&apos;adresse est obligatoire; si la ville est absente, elle vous sera demandée. Le téléphone et le courriel peuvent être ajoutés plus tard.
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
        {pendingCsv ? (
          <div className="mt-4 rounded-lg border border-teal-200 bg-white p-4 dark:border-teal-800 dark:bg-slate-950/70">
            <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">Quelle est la ville de cette liste?</p>
            <p className="mt-1 text-xs text-teal-800/75 dark:text-teal-100/70">{pendingCsv.totalRows} ligne{pendingCsv.totalRows > 1 ? "s" : ""} détectée{pendingCsv.totalRows > 1 ? "s" : ""} dans {pendingCsv.fileName}.</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Ville de la liste
                <input
                  required
                  value={listCity}
                  onChange={(event) => setListCity(event.target.value)}
                  placeholder="Pointe-aux-Trembles"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={continueCsvImport}
                className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Continuer l&apos;import
              </button>
            </div>
          </div>
        ) : null}
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <FilterSelect label="Classe" value={smartFilters.propertyClass} options={["Tous", "Maisons", "Plex", "Condos"]} onChange={(value) => setSmartFilters((current) => ({ ...current, propertyClass: value as SmartFilters["propertyClass"] }))} />
          <NumberFilter label="Valeur min." value={smartFilters.minValue} placeholder="750000" onChange={(value) => setSmartFilters((current) => ({ ...current, minValue: value }))} />
          <NumberFilter label="Année max." value={smartFilters.maxYear} placeholder="1990" onChange={(value) => setSmartFilters((current) => ({ ...current, maxYear: value }))} />
          <NumberFilter label="Terrain min." value={smartFilters.minLandArea} placeholder="700" onChange={(value) => setSmartFilters((current) => ({ ...current, minLandArea: value }))} />
          <NumberFilter label="Détention min." value={smartFilters.minOwnerYears} placeholder="10" onChange={(value) => setSmartFilters((current) => ({ ...current, minOwnerYears: value }))} />
          <TextInput label="Secteur" value={smartFilters.sector} placeholder="COMMUNE" onChange={(value) => setSmartFilters((current) => ({ ...current, sector: value }))} />
          <NumberFilter label="Score min." value={smartFilters.minScore} placeholder="70" onChange={(value) => setSmartFilters((current) => ({ ...current, minScore: value }))} />
        </div>
      </section>

      <RadarMap opportunities={visibleRadarOpportunities} selectedId={selectedVisible?.id || ""} onSelect={setSelectedId} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <SlidersHorizontal className="h-4 w-4" />
            {visibleRadarOpportunities.length} opportunité{visibleRadarOpportunities.length > 1 ? "s" : ""} affichée{visibleRadarOpportunities.length > 1 ? "s" : ""}
          </div>

          {visibleRadarOpportunities.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleRadarOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  active={selectedVisible?.id === opportunity.id}
                  onSelect={() => setSelectedId(opportunity.id)}
                  onFindReachability={openReachabilityPanel}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/72 dark:text-slate-400">
              Aucune opportunité ne correspond aux filtres actuels.
            </div>
          )}
          {!isUnlimitedRadar ? <div className="pt-3">
            <div className="mb-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Opportunités disponibles à débloquer</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Adresse, propriétaire et coordonnées restent masqués jusqu&apos;au déblocage.</p>
            </div>
            {maskedRadarOpportunities.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {maskedRadarOpportunities.map((opportunity) => (
                  <MaskedOpportunityCard key={opportunity.id} opportunity={opportunity} onUnlock={unlockOpportunity} disabled={!radarQuota?.canUnlock} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/72 dark:text-slate-400">
                Aucune opportunité masquée disponible avec ces filtres.
              </div>
            )}
          </div> : null}
        </section>

        {selectedVisible ? <ActionsPanel opportunity={selectedVisible} style={communicationStyle} onStyleChange={setCommunicationStyle} copied={copied} onCopy={copyAction} /> : <LockedActionsPanel />}
      </div>

      {selectedReachabilityProspect ? <ReachabilityPanel prospect={selectedReachabilityProspect} onUpdate={updateProspectLocal} onClose={() => setReachabilityProspectId("")} /> : null}
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

function MaskedOpportunityCard({ opportunity, onUnlock, disabled }: { opportunity: MaskedRadarOpportunity; onUnlock: () => void; disabled?: boolean }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={opportunity.priority} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{opportunity.category}</span>
          </div>
          <h3 className="mt-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Lock className="h-4 w-4 text-slate-400" />
            Adresse masquée
          </h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Building2 className="h-4 w-4" />
            {opportunity.city} · {opportunity.propertyType}
          </p>
        </div>
        <ScoreRing score={opportunity.opportunityScore} />
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{opportunity.reasonGeneral}</p>
      <button
        type="button"
        onClick={onUnlock}
        disabled={disabled}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
      >
        <Lock className="h-4 w-4" />
        Débloquer
      </button>
    </article>
  );
}

function LockedActionsPanel() {
  return (
    <aside className="xl:sticky xl:top-8 xl:self-start">
      <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/72 dark:text-slate-300">
        <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <Lock className="h-4 w-4 text-teal-600" />
          Actions IA verrouillées
        </p>
        <p className="mt-2">Débloquez une opportunité pour voir l&apos;adresse complète, créer le prospect vendeur, appeler avec IACourtier et accéder aux scripts.</p>
      </div>
    </aside>
  );
}

function SourceAuthNotice() {
  return (
    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Connexion requise pour gérer les sources publiques</p>
          <p className="mt-1 leading-6">
            Le Radar peut importer un XML local, mais l&apos;ajout et la synchronisation des sources gouvernementales nécessitent une session active.
          </p>
        </div>
        <a
          href="/connexion?next=/tableau-de-bord/radar-prospection"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          Se connecter
        </a>
      </div>
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

function NumberFilter({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type="number"
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

function RadarMap({ opportunities, selectedId, onSelect }: { opportunities: ProspectRecord[]; selectedId: string; onSelect: (id: string) => void }) {
  const visible = opportunities.slice(0, 120);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
            <MapPin className="h-4 w-4" />
            Carte des opportunitÃ©s
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Positionnement local temporaire basÃ© sur la clÃ© de propriÃ©tÃ©, prÃªt pour le gÃ©ocodage.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Faible</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Moyen</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" />TrÃ¨s fort</span>
        </div>
      </div>
      <div className="relative h-[360px] bg-[linear-gradient(90deg,rgba(15,23,42,.06)_1px,transparent_1px),linear-gradient(0deg,rgba(15,23,42,.06)_1px,transparent_1px)] bg-[size:42px_42px] dark:bg-[linear-gradient(90deg,rgba(148,163,184,.13)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,.13)_1px,transparent_1px)]">
        <div className="absolute inset-6 rounded-lg border border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40" />
        {visible.map((opportunity) => {
          const position = mapPosition(opportunity);
          const active = selectedId === opportunity.id;
          return (
            <button
              key={opportunity.id}
              type="button"
              onClick={() => onSelect(opportunity.id)}
              title={`${opportunity.address} - ${opportunity.opportunityScore}/100`}
              className={cn(
                "absolute z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-lg transition hover:scale-110 dark:border-slate-950",
                mapMarkerColor(opportunity.opportunityScore),
                active ? "scale-125 ring-4 ring-slate-950/15 dark:ring-white/20" : "",
              )}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              {opportunity.opportunityScore}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OpportunityCard({
  opportunity,
  active,
  onSelect,
  onFindReachability,
}: {
  opportunity: ProspectRecord;
  active: boolean;
  onSelect: () => void;
  onFindReachability: (prospectId: string) => void;
}) {
  const router = useRouter();
  const [crmStatus, setCrmStatus] = useState("");

  function createSellerProspect() {
    const prospect = createSellerProspectFromRadar(opportunity);
    router.push(`/tableau-de-bord/prospects/${prospect.id}`);
  }

  async function createOrLinkCrm() {
    setCrmStatus("Recherche des doublons et liaison au CRM…");
    try {
      const response = await fetch("/api/radar/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        radarId: opportunity.id, ownerName: opportunity.ownerName, contactName: opportunity.contactName,
        email: opportunity.email, phone: opportunity.phone, address: opportunity.address, city: opportunity.city,
        postalCode: opportunity.postalCode, propertyType: opportunity.propertyType, reason: opportunity.reason,
        source: sourceLabel(opportunity.source),
      }) });
      const payload = await response.json() as { primaryHref?: string; error?: string };
      if (!response.ok || !payload.primaryHref) throw new Error(payload.error || "Liaison CRM impossible.");
      router.push(payload.primaryHref);
    } catch (reason) { setCrmStatus(reason instanceof Error ? reason.message : "Liaison CRM impossible."); }
  }

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
        {[
          `Source : ${sourceLabel(opportunity.source)}`,
          opportunity.lastUpdated ? `MAJ : ${formatDate(opportunity.lastUpdated)}` : "",
          opportunity.contactName || opportunity.ownerName ? `Contact : ${opportunity.contactName || opportunity.ownerName}` : "",
          opportunity.phone ? `Tél : ${opportunity.phone}` : "",
          opportunity.email ? `Courriel : ${opportunity.email}` : "",
          opportunity.contactStatus ? `Statut : ${opportunity.contactStatus.replace(/_/g, " ")}` : "",
        ].filter(Boolean).map((signal) => (
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
      <div className="mt-2 grid grid-cols-2 gap-2">
        <RadarActionLink opportunity={opportunity} channel="Appel téléphonique" label="Préparer appel" icon={Phone} />
        <RadarActionLink opportunity={opportunity} channel="Message texte" label="Envoyer un message" icon={MessageCircle} />
        <RadarActionLink opportunity={opportunity} channel="Courriel" label="Préparer courriel" icon={Mail} />
        <RadarActionLink opportunity={opportunity} channel="Message Facebook" label="Message Facebook" icon={MessageCircle} />
      </div>
      <button
        type="button"
        onClick={createOrLinkCrm}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
      >
        Créer / relier au CRM
        <ArrowUpRight className="h-4 w-4" />
      </button>
      {crmStatus ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{crmStatus}</p> : null}
      <button type="button" onClick={createSellerProspect} className="mt-2 w-full text-xs font-semibold text-slate-500 hover:text-teal-700">Ouvrir l’ancienne fiche de prospection</button>
      {opportunity.phone ? (
        <>
          <a
            href={`tel:${opportunity.phone.replace(/[^\d+]/g, "")}`}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-4 text-base font-bold text-white transition hover:bg-emerald-700"
          >
            <Phone className="h-5 w-5" />
            Appeler {opportunity.phone}
          </a>
          <button type="button" onClick={() => onFindReachability(opportunity.id)} className="mt-2 w-full text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
            Vérifier ou ajouter une coordonnée
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => onFindReachability(opportunity.id)}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100 dark:hover:bg-indigo-950/50"
        >
          <Search className="h-4 w-4" />
          Trouver comment le joindre
        </button>
      )}
      <Link
        href={`/tableau-de-bord/coach?scenario=radar_owner&city=${encodeURIComponent(opportunity.city)}`}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-950"
      >
        Pratiquer l&apos;appel avec le Coach
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function RadarActionLink({
  opportunity,
  channel,
  label,
  icon: Icon,
}: {
  opportunity: ProspectRecord;
  channel: string;
  label: string;
  icon: ElementType;
}) {
  return (
    <Link
      href={buildRadarActionHref(opportunity, channel)}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
    >
      <Icon className="h-3.5 w-3.5 text-teal-600" />
      {label}
    </Link>
  );
}

function buildRadarActionHref(opportunity: ProspectRecord, channel: string) {
  const params = new URLSearchParams(buildRadarActionContext(opportunity, channel));
  return `/tableau-de-bord/actions/prepare-first-seller-call?${params.toString()}`;
}

function buildRadarActionContext(opportunity: ProspectRecord, channel: string) {
  return {
    context: "radar",
    channel,
    address: opportunity.address || "",
    city: opportunity.city || "",
    propertyType: opportunity.propertyType || "",
    score: String(opportunity.opportunityScore || ""),
    reason: opportunity.reason || "",
    priority: opportunity.priority || "",
    status: opportunity.status || "reserved",
    source: sourceLabel(opportunity.source),
    notes: opportunity.notes || "",
    phone: opportunity.phone || "",
    email: opportunity.email || "",
    name: opportunity.contactName || opportunity.ownerName || "",
  };
}

type ReachabilityHistory = {
  id: string;
  event_type: string;
  source_type: string;
  source_url?: string | null;
  title: string;
  details?: string | null;
  created_at: string;
};

type ReachabilitySnapshot = {
  linked?: boolean;
  clientId?: string;
  caseId?: string;
  contact?: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    facebookUrl?: string | null;
    links?: Array<{ link_type: "facebook" | "other"; label?: string | null; url: string }>;
  } | null;
  history?: ReachabilityHistory[];
  error?: string;
};

function ReachabilityPanel({ prospect, onUpdate, onClose }: { prospect: ProspectRecord; onUpdate: (prospectId: string, patch: Partial<ProspectRecord>) => void; onClose: () => void }) {
  const [nameValue, setNameValue] = useState(prospect.ownerName || prospect.contactName || "");
  const [contactType, setContactType] = useState<"phone" | "email" | "facebook" | "other">("phone");
  const [contactValue, setContactValue] = useState(prospect.phone || "");
  const [linkLabel, setLinkLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [snapshot, setSnapshot] = useState<ReachabilitySnapshot>({ history: [] });
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const prospectPayload = useMemo(() => ({
    key: prospect.id,
    name: nameValue,
    address: prospect.address,
    city: prospect.city,
    province: prospect.province || "Québec",
    postalCode: prospect.postalCode || "",
    propertyType: prospect.propertyType,
    reason: prospect.reason,
    source: sourceLabel(prospect.source),
  }), [nameValue, prospect]);

  const displayPhone = snapshot.contact?.phone || prospect.phone || "";
  const displayEmail = snapshot.contact?.email || prospect.email || "";
  const displayFacebook = snapshot.contact?.facebookUrl || prospect.facebookUrl || "";
  const contactName = nameValue.trim();
  const quotedName = contactName ? `"${contactName}"` : "";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([prospect.address, prospect.city, prospect.province || "Québec", prospect.postalCode || ""].filter(Boolean).join(", "))}`;
  const searchOptions = [
    { source: "google" as const, label: "Nom + ville", query: `${quotedName} "${prospect.city}"` },
    { source: "google" as const, label: "Nom + adresse", query: `${quotedName} "${prospect.address}"` },
    { source: "google" as const, label: "Nom + téléphone", query: `${quotedName} téléphone` },
    { source: "google" as const, label: "Nom + immobilier", query: `${quotedName} immobilier "${prospect.city}"` },
    { source: "google" as const, label: "Nom exact", query: quotedName || `"${prospect.address}"` },
    { source: "google_facebook" as const, label: "Google → Facebook", query: `site:facebook.com ${quotedName} "${prospect.city}"` },
  ].map((item) => ({ ...item, url: `https://www.google.com/search?q=${encodeURIComponent(item.query.trim())}` }));

  useEffect(() => {
    setNameValue(prospect.ownerName || prospect.contactName || "");
    setContactType("phone");
    setContactValue(prospect.phone || "");
    setLinkLabel("");
    setSourceUrl("");
    setIdentityConfirmed(false);
    setStatus("");
    void loadReachability();
    // Recharger uniquement lorsqu'une autre opportunité est ouverte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospect.id]);

  async function loadReachability() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/radar/reachability?prospectKey=${encodeURIComponent(prospect.id)}`, { cache: "no-store" });
      const payload = await response.json() as ReachabilitySnapshot;
      if (!response.ok) throw new Error(payload.error || "La recherche n’a pas pu être chargée.");
      setSnapshot(payload);
      if (payload.contact?.name) setNameValue(payload.contact.name);
      syncProspect(payload);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "La recherche n’a pas pu être chargée.");
    } finally {
      setIsLoading(false);
    }
  }

  function syncProspect(payload: ReachabilitySnapshot) {
    if (!payload.contact) return;
    onUpdate(prospect.id, {
      phone: payload.contact.phone || undefined,
      email: payload.contact.email || undefined,
      facebookUrl: payload.contact.facebookUrl || undefined,
      publicLinks: payload.contact.links?.map((link) => ({ type: link.link_type, label: link.label || undefined, url: link.url })),
      clientId: payload.clientId,
      caseId: payload.caseId,
      contactStatus: payload.contact.phone ? "a_contacter" : "nouveau",
    });
  }

  function openSearch(source: "google" | "facebook" | "google_facebook" | "google_maps" | "web_ai", label: string, url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    void fetch("/api/radar/reachability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log_search", prospect: prospectPayload, searchSource: source, searchLabel: label, searchUrl: url }),
    }).then(async (response) => {
      if (response.ok) await loadReachability();
    });
  }

  async function confirmContact() {
    if (!identityConfirmed) {
      setStatus("Cochez d’abord « C’est la bonne personne ».");
      return;
    }
    setIsSaving(true);
    setStatus("Vérification des doublons et enregistrement dans le CRM central…");
    try {
      const response = await fetch("/api/radar/reachability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_contact", prospect: prospectPayload, contactType, value: contactValue, label: linkLabel, sourceUrl, identityConfirmed }),
      });
      const payload = await response.json() as ReachabilitySnapshot;
      if (!response.ok) throw new Error(payload.error || "La coordonnée n’a pas pu être enregistrée.");
      setSnapshot(payload);
      syncProspect(payload);
      setStatus("Coordonnée confirmée et enregistrée dans le CRM central avec sa provenance.");
      setContactValue("");
      setSourceUrl("");
      setIdentityConfirmed(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "La coordonnée n’a pas pu être enregistrée.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createFollowUp() {
    setIsSaving(true);
    setStatus("Création du suivi dans le dossier CRM…");
    try {
      const response = await fetch("/api/radar/reachability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_followup", prospect: prospectPayload }),
      });
      const payload = await response.json() as ReachabilitySnapshot;
      if (!response.ok) throw new Error(payload.error || "Le suivi n’a pas pu être créé.");
      setSnapshot(payload);
      syncProspect(payload);
      setStatus("Suivi créé pour demain dans le dossier CRM.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Le suivi n’a pas pu être créé.");
    } finally {
      setIsSaving(false);
    }
  }

  function chooseContactType(type: typeof contactType) {
    setContactType(type);
    setContactValue(type === "phone" ? displayPhone : type === "email" ? displayEmail : type === "facebook" ? displayFacebook : "");
    setIdentityConfirmed(false);
  }

  async function copyEmail() {
    if (!displayEmail) return;
    await navigator.clipboard.writeText(displayEmail);
    setStatus("Courriel copié.");
  }

  return (
    <section id="radar-reachability" className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/25">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Recherche publique assistée</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-indigo-950 dark:text-indigo-100">Trouver comment le joindre</h2>
          <p className="mt-1 text-sm text-indigo-900/70 dark:text-indigo-100/70">Aucune identité n’est présumée : vérifiez la personne avant d’enregistrer une coordonnée.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-950 dark:text-indigo-100">Fermer</button>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-indigo-100 bg-white p-4 text-sm dark:border-indigo-900 dark:bg-slate-950/55 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="font-semibold">Prospect</span>
          <input value={nameValue} onChange={(event) => setNameValue(event.target.value)} placeholder="Nom à confirmer" className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <p><span className="font-semibold">Adresse :</span><br />{prospect.address}</p>
        <p><span className="font-semibold">Ville :</span><br />{prospect.city}</p>
        <p><span className="font-semibold">État :</span><br />{isLoading ? "Chargement…" : reachabilityStatusLabel({ ...prospect, phone: displayPhone, email: displayEmail, facebookUrl: displayFacebook })}</p>
      </div>

      {displayPhone || displayEmail || displayFacebook ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {displayPhone ? <a href={`tel:${displayPhone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-4 text-base font-bold text-white hover:bg-emerald-700"><Phone className="h-5 w-5" />Appeler {displayPhone}</a> : null}
          {displayEmail ? <button type="button" onClick={copyEmail} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"><Copy className="h-4 w-4" />Copier {displayEmail}</button> : null}
          {displayFacebook ? <a href={displayFacebook} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100"><ArrowUpRight className="h-4 w-4" />Ouvrir Facebook</a> : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => openSearch("google", "Google — nom et adresse", searchOptions[1].url)} className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">Google</button>
        <button type="button" onClick={() => openSearch("facebook", "Recherche directe Facebook", `https://www.facebook.com/search/top?q=${encodeURIComponent(`${contactName} ${prospect.city}`.trim())}`)} className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Facebook</button>
        <button type="button" onClick={() => openSearch("google_maps", "Google Maps — adresse", mapsUrl)} className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Google / Maps</button>
        <button type="button" onClick={() => openSearch("web_ai", "Web/IA — recherche exacte", searchOptions[4].url)} className="rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700">Web / IA</button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/55">
        <h3 className="text-sm font-semibold">Recherches préparées</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">Ces requêtes consultent uniquement des pages publiques. Un résultat reste une correspondance possible tant que vous ne l’avez pas confirmé.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {searchOptions.map((option) => (
            <button key={`${option.source}-${option.label}`} type="button" onClick={() => openSearch(option.source, option.label, option.url)} className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
              {option.label}<span className="mt-1 block truncate text-xs font-normal text-slate-500">{option.query}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/25">
        <p className="text-sm font-bold text-amber-950 dark:text-amber-100">Correspondance possible — non confirmée</p>
        <p className="mt-1 text-xs leading-5 text-amber-900/75 dark:text-amber-100/75">Saisissez seulement une coordonnée trouvée dans une source publique et confirmez l’identité avant l’enregistrement.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="text-sm font-semibold">Type
            <select value={contactType} onChange={(event) => chooseContactType(event.target.value as typeof contactType)} className="mt-1 h-11 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm dark:border-amber-800 dark:bg-slate-950">
              <option value="phone">Téléphone</option><option value="email">Courriel</option><option value="facebook">Facebook</option><option value="other">Autre lien</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Coordonnée
            <input value={contactValue} onChange={(event) => setContactValue(event.target.value)} placeholder={contactType === "phone" ? "514-000-0000" : contactType === "email" ? "nom@exemple.com" : "https://…"} className="mt-1 h-11 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm dark:border-amber-800 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-semibold">URL de la source (facultatif)
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" className="mt-1 h-11 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm dark:border-amber-800 dark:bg-slate-950" />
          </label>
        </div>
        {contactType === "other" ? <input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Nom du lien (ex. entreprise)" className="mt-3 h-11 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm dark:border-amber-800 dark:bg-slate-950" /> : null}
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-white p-3 text-sm dark:border-amber-800 dark:bg-slate-950">
          <input type="checkbox" checked={identityConfirmed} onChange={(event) => setIdentityConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4" />
          <span><strong>C’est la bonne personne.</strong> J’ai comparé le nom et l’adresse ou la ville; je confirme cette coordonnée.</span>
        </label>
        <button type="button" disabled={isSaving || !identityConfirmed || !contactValue.trim()} onClick={confirmContact} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-3 text-sm font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          C’est la bonne personne — enregistrer dans le CRM
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/55">
          <h3 className="text-sm font-semibold">Aucun résultat fiable?</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Les recherches ouvertes apparaissent dans l’historique. Créez un suivi sans inventer de coordonnée.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={isSaving || !nameValue.trim()} onClick={createFollowUp} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">Créer un suivi</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">Passer au prochain prospect</button>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/55">
          <h3 className="text-sm font-semibold">Historique et provenance</h3>
          {snapshot.history?.length ? <ul className="mt-3 max-h-52 space-y-2 overflow-auto text-xs">
            {snapshot.history.map((event) => <li key={event.id} className="rounded-lg border border-slate-100 p-2 dark:border-slate-800"><span className="font-semibold">{event.title}</span><span className="ml-2 text-slate-400">{new Date(event.created_at).toLocaleString("fr-CA")}</span>{event.details ? <span className="mt-1 block text-slate-500">{event.details}</span> : null}{event.source_url ? <a href={event.source_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-indigo-700 hover:underline dark:text-indigo-300">{event.source_url}</a> : null}</li>)}
          </ul> : <p className="mt-3 text-xs text-slate-500">Aucune recherche enregistrée pour le moment.</p>}
        </div>
      </div>

      {status ? <p className="mt-4 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-900 dark:border-indigo-900 dark:bg-slate-950 dark:text-indigo-100">{status}</p> : null}
    </section>
  );
}

function reachabilityStatusLabel(prospect: ProspectRecord) {
  if (prospect.phone && prospect.email) return "prêt à contacter";
  if (prospect.phone || prospect.email || prospect.facebookUrl) return "partiel";
  return "coordonnées à trouver";
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
    role_evaluation: "Rôle d'évaluation",
  };

  return labels[source];
}

function dedupeProspects(prospects: ProspectRecord[]) {
  const seen = new Set<string>();
  return prospects.filter((prospect) => {
    const key = prospect.leadHash || prospect.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countCsvDataRows(csvText: string) {
  const nonEmptyLines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  return Math.max(0, nonEmptyLines.length - 1);
}

function PropertyInsightCard({ opportunity }: { opportunity: ProspectRecord }) {
  const raw = opportunity.rawData || {};
  const breakdown = Array.isArray(raw.score_breakdown) ? (raw.score_breakdown as Array<{ label?: string; points?: number }>) : [];
  const sources = Array.isArray(raw.enrichment_sources) ? raw.enrichment_sources.map(String) : [sourceLabel(opportunity.source)];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Fiche propriÃ©tÃ© enrichie</h3>
          <p className="mt-1 text-xs text-slate-500">{sources.join(" + ")}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold text-white", mapMarkerColor(opportunity.opportunityScore))}>{opportunity.opportunityScore}/100</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoStat label="Valeur municipale" value={formatCurrency(numberFromRaw(raw.total_value))} />
        <InfoStat label="Type" value={opportunity.propertyType} />
        <InfoStat label="Terrain" value={formatArea(numberFromRaw(raw.land_area))} />
        <InfoStat label="AnnÃ©e" value={stringFromRaw(raw.year_built) || "Non dÃ©tectÃ©e"} />
        <InfoStat label="Matricule" value={stringFromRaw(raw.matricule) || "Non dÃ©tectÃ©"} />
        <InfoStat label="Secteur" value={stringFromRaw(raw.sector) || opportunity.city} />
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/70">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pourquoi ce score</p>
        {breakdown.length ? (
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            {breakdown.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center justify-between gap-3">
                <span>{item.label}</span>
                <span className="font-semibold text-teal-700 dark:text-teal-300">+{item.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{opportunity.reason}</p>
        )}
      </div>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function matchesSmartFilters(item: ProspectRecord, filters: SmartFilters) {
  const type = item.propertyType.toLowerCase();
  if (filters.propertyClass === "Maisons" && !type.includes("unifamiliale") && !type.includes("maison")) return false;
  if (filters.propertyClass === "Plex" && !type.includes("plex") && !type.includes("logement")) return false;
  if (filters.propertyClass === "Condos" && !type.includes("condo")) return false;

  const minValue = Number(filters.minValue || 0);
  if (minValue && numberFromRaw(item.rawData?.total_value) < minValue) return false;

  const maxYear = Number(filters.maxYear || 0);
  if (maxYear) {
    const year = numberFromRaw(item.rawData?.year_built);
    if (!year || year > maxYear) return false;
  }

  const minLandArea = Number(filters.minLandArea || 0);
  if (minLandArea && numberFromRaw(item.rawData?.land_area) < minLandArea) return false;

  const minOwnerYears = Number(filters.minOwnerYears || 0);
  if (minOwnerYears && numberFromRaw(item.rawData?.owner_years) < minOwnerYears) return false;

  const minScore = Number(filters.minScore || 0);
  if (minScore && item.opportunityScore < minScore) return false;

  const sector = filters.sector.trim().toLowerCase();
  if (sector && !stringFromRaw(item.rawData?.sector).toLowerCase().includes(sector) && !item.address.toLowerCase().includes(sector)) return false;

  return true;
}

function mapPosition(opportunity: ProspectRecord) {
  const key = stringFromRaw(opportunity.rawData?.normalized_property_key) || opportunity.leadHash || opportunity.id;
  const hash = hashString(key);
  return {
    x: 8 + (hash % 84),
    y: 10 + (Math.floor(hash / 97) % 78),
  };
}

function mapMarkerColor(score: number) {
  if (score >= 80) return "bg-rose-600";
  if (score >= 60) return "bg-amber-500";
  return "bg-emerald-500";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function numberFromRaw(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringFromRaw(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function formatCurrency(value: number) {
  return value ? new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value) : "Non détectée";
}

function formatArea(value: number) {
  return value ? `${value.toLocaleString("fr-CA")} m²` : "Non détecté";
}

function ActionsPanel({
  opportunity,
  style,
  onStyleChange,
  copied,
  onCopy,
}: {
  opportunity: ProspectRecord;
  style: ProspectingCommunicationStyle;
  onStyleChange: (style: ProspectingCommunicationStyle) => void;
  copied: string;
  onCopy: (label: string, value: string) => void;
}) {
  const actions = createProspectingActions(opportunity, style);
  const [callNote, setCallNote] = useState("");
  const [coachSuggestion, setCoachSuggestion] = useState<CallCoachSuggestion | null>(null);
  useEffect(() => {
    setCallNote("");
    setCoachSuggestion(null);
  }, [opportunity.id, style]);

  const actionItems = [
    { label: "Premier appel", icon: Phone, value: actions.call },
    { label: "Premier texto", icon: MessageCircle, value: actions.sms },
    { label: "Premier courriel", icon: Mail, value: actions.email },
    { label: "Message social", icon: MessageCircle, value: actions.facebook },
    { label: "Relance après 7 jours", icon: RotateCcw, value: actions.followUp7 },
    { label: "Relance après 30 jours", icon: RotateCcw, value: actions.followUp30 },
  ];

  function appendCallTranscript(transcript: string) {
    setCallNote((current) => [current.trim(), transcript.trim()].filter(Boolean).join(" "));
  }

  return (
    <aside className="xl:sticky xl:top-8 xl:self-start">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-premium dark:border-slate-800 dark:bg-slate-900/76">
        <div className="border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Scripts de contact</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{opportunity.address}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Messages naturels pour ouvrir la conversation et mener vers un rendez-vous d&apos;évaluation.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/45">
            <label className="text-sm font-semibold" htmlFor="communication-style">
              Style de communication
            </label>
            <select
              id="communication-style"
              value={style}
              onChange={(event) => onStyleChange(event.target.value as ProspectingCommunicationStyle)}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {prospectingCommunicationStyles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <PropertyInsightCard opportunity={opportunity} />

          {actionItems.map((item) => (
            <ActionBlock key={item.label} label={item.label} value={item.value} copied={copied === item.label} icon={item.icon} onCopy={() => onCopy(item.label, item.value)} />
          ))}

          <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900 dark:bg-teal-950/30">
            <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-100">Objections et réponses</h3>
            <div className="mt-3 space-y-3">
              {actions.objectionPlaybooks.map((item) => (
                <div key={item.id} className="rounded-lg border border-teal-200/70 bg-white/80 p-3 text-sm leading-6 dark:border-teal-900 dark:bg-slate-950/40">
                  <p className="font-semibold text-teal-950 dark:text-teal-100">{item.objection}</p>
                  <p className="mt-1 text-teal-900/80 dark:text-teal-100/80">{item.shortResponse}</p>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">Question : {item.followUpQuestion}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300">{item.conversionGoal}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/45">
            <h3 className="text-sm font-semibold">Coach après appel</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Collez une courte note d&apos;appel pour obtenir la prochaine meilleure action.</p>
            <VoiceDictationButton onTranscript={appendCallTranscript} className="mt-3" />
            <textarea
              value={callNote}
              onChange={(event) => setCallNote(event.target.value)}
              placeholder="Ex. Le propriétaire dit qu'il veut attendre au printemps, mais il est curieux de connaître la valeur."
              className="mt-3 min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() =>
                setCoachSuggestion(
                  coachSalesCall({
                    note: callNote,
                    style,
                    prospect: {
                      contactName: opportunity.contactName,
                      ownerName: opportunity.ownerName,
                      address: opportunity.address,
                      city: opportunity.city,
                      propertyType: opportunity.propertyType,
                    },
                  }),
                )
              }
              disabled={!callNote.trim()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <Sparkles className="h-4 w-4" />
              Analyser l&apos;appel
            </button>

            {coachSuggestion && (
              <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 dark:border-slate-800 dark:bg-slate-900/60">
                <CoachLine label="À améliorer" value={coachSuggestion.whatCouldBeBetter} />
                <CoachLine label="Prochaine question" value={coachSuggestion.nextQuestion} />
                <CoachLine label="Prochaine relance" value={coachSuggestion.nextFollowUp} />
                <CoachLine label="Angle de reprise" value={coachSuggestion.bestReentryAngle} />
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function CoachLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-slate-700 dark:text-slate-200">{value}</p>
    </div>
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

