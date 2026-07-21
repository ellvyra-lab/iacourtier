"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CalendarCheck, CheckCircle2, Clock3, FileText, Home, Phone, Sparkles, Upload, Users } from "lucide-react";

import {
  buyerPipelineStatuses,
  getEmployeeName,
  sellerPipelineStatuses,
  type PipelineClient,
  type PipelineDashboardData,
  type PipelineStatus,
} from "@/lib/pipeline-intelligence";
import { contextFromPipelineStatus, getContextualAiActions } from "@/lib/ai-actions";
import { cn } from "@/lib/utils";
import {
  clearAllClientWorkspaceData,
  generateCollectionRequests,
  getClientDatabaseHealth,
  getCollectionRequests,
  getCollectionSummary,
  getWorkspaceDeletionSummary,
  isClientDatabaseReset,
  type MissingDataField,
} from "@/lib/client-data-collection";
import {
  AUTOMATION_TYPE_LABELS,
  getAutomationMode,
  getAutomationSummary,
  getClientAutomations,
  getCommunicationBlockReason,
  setAutomationMode,
  syncClientAutomations,
  updateClientAutomation,
  type AutomationMode,
  type AutomationStatus,
  type AutomationType,
  type ClientAutomation,
} from "@/lib/client-automations";
import { getSoniaProspects } from "@/lib/sonia-beta/storage";
import type { ClientImportProfile, SoniaProspect } from "@/lib/sonia-beta/types";
import {
  IMPORT_FIELD_LABELS,
  RELATIONSHIP_LABELS,
  findDuplicates,
  getImportStatistics,
  importClientRows,
  parseClientFile,
  type ColumnMapping,
  type DuplicateDecision,
  type ImportListMode,
  type ImportPreview,
  type ImportReport,
} from "@/lib/client-import";

export function IntelligentPipelineDashboard({ data }: { data: PipelineDashboardData }) {
  const [selectedId, setSelectedId] = useState(data.clients[0]?.id || "");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [databaseWasReset, setDatabaseWasReset] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [databaseVersion, setDatabaseVersion] = useState(0);
  const [deletionSummary, setDeletionSummary] = useState({ clients: 0, automations: 0, followUps: 0, histories: 0, duplicates: 0, campaigns: 0 });
  const [storedContacts, setStoredContacts] = useState<SoniaProspect[]>([]);

  function refreshStoredContacts() {
    setStoredContacts(getSoniaProspects().filter((contact) => !contact.id.startsWith("sonia-demo-")));
  }

  useEffect(() => {
    setDatabaseWasReset(isClientDatabaseReset());
    refreshStoredContacts();
  }, []);

  const importedClients = useMemo(() => storedContacts.map(toPipelineClient), [storedContacts]);
  const clients = useMemo(() => {
    const importedIds = new Set(importedClients.map((client) => client.id));
    return [...importedClients, ...(databaseWasReset ? [] : data.clients.filter((client) => !importedIds.has(client.id)))];
  }, [data.clients, databaseWasReset, importedClients]);
  const importedProfiles = useMemo(() => new Map(storedContacts.map((contact) => [contact.id, contact.importProfile])), [storedContacts]);
  const selected = clients.find((client) => client.id === selectedId) || clients[0];
  const sellerClients = clients.filter((client) => client.type === "seller");
  const buyerClients = clients.filter((client) => client.type === "buyer");
  const activeActions = useMemo(() => clients.flatMap((client) => client.actions.map((action) => ({ ...action, client }))).slice(0, 8), [clients]);

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-7">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Pipeline intelligent</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Chaque client avance avec la bonne équipe IA</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              IACourtier n&apos;est plus organisé par modules. Le logiciel suit le parcours vendeur et acheteur, déclenche les bons employés IA au bon statut et conserve une timeline complète pour chaque client.
            </p>
          </div>

          <TodayCard data={data} empty={databaseWasReset && storedContacts.length === 0} />
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => { setDeletionSummary(getWorkspaceDeletionSummary()); setResetComplete(false); setClearStep(1); }}
          className="inline-flex items-center justify-center rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 dark:border-red-900 dark:text-red-300"
        >
          Réinitialiser complètement la base de données
        </button>
        <button
          type="button"
          onClick={() => setIsImportOpen((current) => !current)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          <Upload className="h-4 w-4" />
          Importer mes clients
        </button>
      </div>

      {clearStep ? (
        <section className="rounded-lg border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20">
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
            {clearStep === 1 ? "Réinitialiser complètement la base de données?" : "Dernière confirmation"}
          </h2>
          <p className="mt-2 text-sm text-red-800 dark:text-red-200">Vous allez supprimer complètement :</p>
          <ul className="mt-3 grid gap-2 text-sm text-red-800 dark:text-red-200 sm:grid-cols-2 lg:grid-cols-3">
            <li>• {deletionSummary.clients.toLocaleString("fr-CA")} contacts et prospects</li>
            <li>• {deletionSummary.automations.toLocaleString("fr-CA")} automatisations</li>
            <li>• {deletionSummary.histories.toLocaleString("fr-CA")} historiques</li>
            <li>• {deletionSummary.followUps.toLocaleString("fr-CA")} suivis associés</li>
            <li>• {deletionSummary.duplicates.toLocaleString("fr-CA")} doublons indexés</li>
            <li>• {deletionSummary.campaigns.toLocaleString("fr-CA")} campagnes</li>
          </ul>
          <p className="mt-4 font-semibold text-red-900 dark:text-red-100">Cette opération est irréversible. Les paramètres, préférences et configurations seront conservés.</p>
          {clearStep === 2 ? <p className="mt-3 rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-950 dark:bg-red-950 dark:text-red-100">Confirmez une seconde fois pour vider définitivement toutes les données locales associées à la base clients.</p> : null}
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setClearStep(0)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold dark:bg-slate-950">Annuler</button>
            {clearStep === 1 ? (
              <button type="button" onClick={() => setClearStep(2)} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Continuer</button>
            ) : (
              <button type="button" onClick={() => {
                const emptySummary = clearAllClientWorkspaceData();
                setDeletionSummary(emptySummary);
                setDatabaseWasReset(true);
                setResetComplete(true);
                setIsImportOpen(false);
                setDatabaseVersion((version) => version + 1);
                refreshStoredContacts();
                setClearStep(0);
              }} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Confirmer la réinitialisation complète</button>
            )}
          </div>
        </section>
      ) : null}

      {resetComplete ? (
        <section className="rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
          <p className="font-semibold text-teal-900 dark:text-teal-100">Base de données réinitialisée</p>
          <p className="mt-2 text-sm text-teal-800 dark:text-teal-200">0 contact · 0 automatisation · 0 historique · 0 doublon · 0 campagne</p>
        </section>
      ) : null}

      {isImportOpen ? <ClientImportPanel onImported={refreshStoredContacts} /> : null}

      <ClientDatabaseHealthSection contacts={storedContacts} />

      <MissingInformationSection key={`missing-${databaseVersion}`} contacts={storedContacts} />

      <ClientAutomationsSection key={`automations-${databaseVersion}`} contacts={storedContacts} />

      <section className="grid gap-4 lg:grid-cols-5">
        {data.employees.map((employee) => (
          <div key={employee.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200">
              <Bot className="h-4 w-4" />
            </div>
            <p className="mt-3 text-base font-semibold">{employee.name}</p>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{employee.role}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{employee.specialty}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="space-y-6">
          <PipelineLane title="Parcours vendeur" icon={Home} statuses={sellerPipelineStatuses} clients={sellerClients} selectedId={selected?.id} onSelect={setSelectedId} />
          <PipelineLane title="Parcours acheteur" icon={Users} statuses={buyerPipelineStatuses} clients={buyerClients} selectedId={selected?.id} onSelect={setSelectedId} />
        </section>

        {selected ? <ClientPanel client={selected} importProfile={importedProfiles.get(selected.id)} activeActions={activeActions.filter((action) => action.client.id === selected.id)} /> : null}
      </div>
    </div>
  );
}

function toPipelineClient(contact: SoniaProspect): PipelineClient {
  return {
    id: contact.id,
    type: contact.clientType,
    name: contact.name,
    address: contact.address,
    city: contact.city,
    status: contact.status,
    priority: contact.importProfile?.missingInformation.length ? "Moyenne" : "Faible",
    nextStep: contact.nextAction,
    updatedAt: contact.updatedAt,
    actions: [],
    timeline: contact.history.map((event) => ({
      id: event.id,
      date: event.date,
      title: event.title,
      description: event.description,
    })),
  };
}

function ClientImportPanel({ onImported }: { onImported: () => void }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<ImportListMode | "">("");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setReport(null);
    setImportMode("");
    setReplaceConfirmed(false);
    try {
      setPreview(await parseClientFile(file));
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "Impossible de lire ce fichier.");
    }
  }

  function updateMapping(header: string, field: ColumnMapping[string]) {
    setPreview((current) => current ? {
      ...current,
      mapping: { ...current.mapping, [header]: field },
      uncertainHeaders: current.uncertainHeaders.filter((item) => item !== header),
    } : current);
    setReport(null);
  }

  if (!preview) {
    return (
      <section className="rounded-lg border border-teal-200 bg-teal-50/60 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/20">
        <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">Importer mes clients</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sélectionnez un fichier CSV, XLSX ou XLS. Le Coach IA repère la feuille, la ligne d’en-tête, les tags et les colonnes utiles sans exiger une structure précise.</p>
        <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleFile} className="mt-4 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2.5 file:font-semibold file:text-white dark:file:bg-white dark:file:text-slate-950" />
        {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      </section>
    );
  }

  const statistics = getImportStatistics(preview.rows, preview.mapping);
  const duplicates = findDuplicates(preview.rows, preview.mapping, getSoniaProspects());
  const previewRows = preview.rows.slice(0, 20);

  function confirmImport() {
    if (!preview) {
      setError("Aucun fichier prêt à importer.");
      return;
    }
    if (!importMode) {
      setError("Choisissez comment traiter la liste actuelle.");
      return;
    }
    if (importMode === "replace" && !replaceConfirmed) {
      setError("Confirmez que la liste actuelle peut être remplacée.");
      return;
    }
    const decisions = Object.fromEntries(duplicates.map((duplicate) => [
      duplicate.rowNumber,
      importMode === "new-only" ? "ignore" : "merge",
    ])) as Record<number, DuplicateDecision>;
    const result = importClientRows(preview.rows, preview.mapping, decisions, importMode);
    setReport(result);
    setError("");
    onImported();
  }

  return (
    <section className="space-y-5 rounded-lg border border-teal-200 bg-white p-5 shadow-sm dark:border-teal-900 dark:bg-slate-900/72">
      <div>
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Assistant d’importation · Aperçu</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choisissez d’abord le traitement de la liste actuelle. Les doublons et les types issus des tags seront ensuite traités automatiquement.</p>
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <legend className="px-1 text-sm font-semibold">Gestion de la liste</legend>
        <div className="mt-2 grid gap-3 lg:grid-cols-3">
          {[
            ["replace", "Remplacer complètement la liste actuelle", "Supprime les contacts existants et conserve uniquement ce fichier."],
            ["new-only", "Ajouter seulement les nouveaux", "Ignore automatiquement les contacts déjà présents."],
            ["merge", "Fusionner avec l’existant", "Complète uniquement les champs vides selon le courriel, le téléphone ou le nom et l’adresse."],
          ].map(([value, title, description]) => (
            <label key={value} className={cn("cursor-pointer rounded-lg border p-4", importMode === value ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30" : "border-slate-200 dark:border-slate-800")}>
              <span className="flex items-start gap-3">
                <input type="radio" name="import-list-mode" checked={importMode === value} onChange={() => { setImportMode(value as ImportListMode); setReplaceConfirmed(false); setError(""); }} className="mt-1 accent-teal-700" />
                <span><span className="block font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
              </span>
            </label>
          ))}
        </div>
        {importMode === "replace" ? (
          <label className="mt-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100">
            <input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} className="mt-0.5" />
            Je confirme que tous les contacts actuels, leurs automatisations et leurs demandes de renseignements locales seront supprimés avant l’import.
          </label>
        ) : null}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Contacts détectés", statistics.contacts],
          ["Doublons possibles", statistics.duplicates],
          ["Courriels manquants", statistics.missingEmails],
          ["Téléphones manquants", statistics.missingPhones],
          ["Renouvellements manquants", statistics.missingMortgageRenewals],
          ["Naissances manquantes", statistics.missingBirthDates],
        ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Association des colonnes</h3>
        {preview.uncertainHeaders.length ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Seules les associations incertaines demandent votre attention.</p> : <p className="mt-1 text-xs text-teal-700">Toutes les colonnes utiles ont été reconnues automatiquement.</p>}
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {preview.headers.map((header) => (
            <label key={header} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <span className="mb-2 block font-semibold">{header}</span>
              <select value={preview.mapping[header]} onChange={(event) => updateMapping(header, event.target.value as ColumnMapping[string])} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                {Object.entries(IMPORT_FIELD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Aperçu des contacts</h3><p className="text-xs text-slate-500">20 lignes maximum sur {preview.rows.length.toLocaleString("fr-CA")}</p></div>
        <table className="mt-3 min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="p-2">Ligne</th><th className="p-2">Aperçu</th><th className="p-2">Type détecté</th><th className="p-2">État</th></tr></thead>
          <tbody>{previewRows.map((row) => {
            const duplicate = duplicates.find((item) => item.rowNumber === row.rowNumber);
            return <tr key={row.rowNumber} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2">{row.rowNumber}</td><td className="max-w-sm p-2">{Object.values(row.values).filter(Boolean).slice(0, 3).join(" · ") || "Ligne vide"}</td><td className="p-2">{RELATIONSHIP_LABELS[row.relationshipType]}</td><td className="p-2 text-xs">{duplicate ? "Doublon détecté" : "Nouveau"}</td></tr>;
          })}</tbody>
        </table>
      </div>

      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={confirmImport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"><Upload className="h-4 w-4" />Importer</button>
        <button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-slate-700">Annuler</button>
      </div>

      {report ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 text-sm dark:border-teal-900 dark:bg-teal-950/30">
          <p className="font-semibold">Import terminé</p>
          <p className="mt-2">Contacts avant : {report.contactsBefore} · Ajoutés : {report.contactsAdded} · Fusionnés : {report.contactsMerged} · Doublons ignorés : {report.duplicatesIgnored} · Contacts après : {report.contactsAfter}</p>
          <p className="mt-1">Lignes ignorées : {report.ignored} · Erreurs : {report.errors.length} · Prêts pour automatisation : {report.readyForAutomation} · À compléter : {report.contactsToComplete}</p>
          {report.errors.length ? <ul className="mt-2 list-disc pl-5">{report.errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}
        </div>
      ) : null}
    </section>
  );
}

function ClientDatabaseHealthSection({ contacts }: { contacts: SoniaProspect[] }) {
  const health = getClientDatabaseHealth(contacts);
  const metrics = [
    ["Base clients", health.metrics.complete],
    ["Courriels", health.metrics.emails],
    ["Téléphones", health.metrics.phones],
    ["Consentements", health.metrics.consents],
    ["Dates de renouvellement hypothécaire", health.metrics.mortgageRenewals],
    ["Dates de naissance", health.metrics.birthDates],
    ["Dates de transaction", health.metrics.transactionDates],
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Santé de la base</p>
      <h2 className="mt-1 text-2xl font-semibold">Base clients · {health.total.toLocaleString("fr-CA")} fiches</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-3xl font-semibold">{value} %</p>
            <p className="mt-1 text-sm font-medium">{label}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-teal-600" style={{ width: `${value}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MissingInformationSection({ contacts }: { contacts: SoniaProspect[] }) {
  const [requests, setRequests] = useState<ReturnType<typeof getCollectionRequests>>([]);
  const [copied, setCopied] = useState("");
  const summary = getCollectionSummary(contacts, requests);
  const mortgageMissing = summary.find((item) => item.field === "mortgageRenewal")?.missing || 0;

  useEffect(() => {
    setRequests(getCollectionRequests());
  }, []);

  function prepare(field: MissingDataField) {
    generateCollectionRequests(field, contacts);
    setRequests(getCollectionRequests());
  }

  async function copyLink(link: string, field: string) {
    await navigator.clipboard.writeText(link);
    setCopied(field);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Coach IA</p>
      <h2 className="mt-1 text-2xl font-semibold">Informations à compléter</h2>
      <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
        Aujourd’hui : {contacts.length.toLocaleString("fr-CA")} clients. {mortgageMissing.toLocaleString("fr-CA")} clients sans renouvellement hypothécaire. Je te recommande de préparer la campagne de mise à jour; elle alimentera automatiquement les futures automatisations.
      </div>
      <div className="mt-5 space-y-3">
        {summary.map((item) => (
          <details key={item.field} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span><span className="font-semibold">{item.missing.toLocaleString("fr-CA")} clients n’ont pas de {item.label.toLowerCase()}.</span><span className="mt-1 block text-xs text-slate-500">{item.responses} réponses · {item.updated} fiches mises à jour · {item.excluded} exclus</span></span>
              <span className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Préparer la campagne</span>
            </summary>
            <div className="mt-4 grid gap-3 text-sm">
              <p><strong>Objet :</strong> {item.campaign.subject}</p>
              <p><strong>Courriel :</strong> {item.campaign.email}</p>
              <div><strong>Message :</strong><p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 dark:bg-slate-950">{item.latestMessage}</p></div>
              <p><strong>Question :</strong> {item.campaign.question}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!item.missing} onClick={() => prepare(item.field)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Préparer la campagne</button>
                {item.latestLink ? <><a href={item.latestLink} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">Ouvrir le formulaire sécurisé</a><button type="button" onClick={() => copyLink(item.latestLink!, item.field)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">{copied === item.field ? "Lien copié" : "Copier le lien"}</button></> : null}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

type BirthdayAutomationStatus = {
  birthdaysToday: number;
  sent: number;
  blocked: number;
  missingEmails: number;
  missingConsents: number;
  nextBirthday: { name: string; date: string } | null;
};

const emptyBirthdayStatus: BirthdayAutomationStatus = {
  birthdaysToday: 0,
  sent: 0,
  blocked: 0,
  missingEmails: 0,
  missingConsents: 0,
  nextBirthday: null,
};

function ClientAutomationsSection({ contacts }: { contacts: SoniaProspect[] }) {
  const [mode, setMode] = useState<AutomationMode>("approval");
  const [automations, setAutomations] = useState<ClientAutomation[]>([]);
  const [typeFilter, setTypeFilter] = useState<AutomationType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AutomationStatus | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [birthdayStatus, setBirthdayStatus] = useState<BirthdayAutomationStatus>(emptyBirthdayStatus);
  const [birthdayContactId, setBirthdayContactId] = useState("");
  const [birthdayTestEmail, setBirthdayTestEmail] = useState("");
  const [birthdayTone, setBirthdayTone] = useState<"chaleureux" | "professionnel" | "amical">("chaleureux");
  const [birthdayTestResult, setBirthdayTestResult] = useState("");
  const [birthdayTestRunning, setBirthdayTestRunning] = useState(false);
  const selected = automations.find((item) => item.id === selectedId);
  const summary = getAutomationSummary(automations, contacts);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const savedMode = getAutomationMode();
    setMode(savedMode);
    setAutomations(syncClientAutomations(contacts, savedMode));
  }, [contacts]);

  useEffect(() => {
    const birthdayContacts = contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      birthDate: contact.importProfile?.birthDate,
      consent: Boolean(contact.importProfile?.communicationConsent),
      excluded: /ne plus contacter/i.test([contact.status, contact.notes, contact.nextAction].join(" ")),
    }));
    async function refreshBirthdays() {
      await fetch("/api/automations/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", contacts: birthdayContacts }),
      });
      const response = await fetch("/api/automations/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" }),
      });
      if (response.ok) setBirthdayStatus(await response.json() as BirthdayAutomationStatus);
    }
    void refreshBirthdays();
  }, [contacts]);

  async function testBirthday() {
    const contact = contacts.find((item) => item.id === birthdayContactId);
    if (!contact || !birthdayTestEmail.trim()) {
      setBirthdayTestResult("Choisissez un contact et indiquez l’adresse de test autorisée.");
      return;
    }
    setBirthdayTestRunning(true);
    setBirthdayTestResult("");
    const response = await fetch("/api/automations/birthdays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test",
        testEmail: birthdayTestEmail,
        tone: birthdayTone,
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          birthDate: contact.importProfile?.birthDate,
          consent: Boolean(contact.importProfile?.communicationConsent),
          excluded: /ne plus contacter/i.test([contact.status, contact.notes, contact.nextAction].join(" ")),
        },
      }),
    });
    const payload = await response.json() as { error?: string; result?: { status?: string; subject?: string; simulated?: boolean } };
    setBirthdayTestResult(response.ok
      ? `${payload.result?.simulated ? "Simulation réussie" : "Courriel test envoyé"} · ${payload.result?.subject || "Bonne fête"} · le vrai contact n’a pas été marqué comme contacté.`
      : payload.error || "Le test a échoué.");
    setBirthdayTestRunning(false);
  }

  function changeMode(nextMode: AutomationMode) {
    setMode(nextMode);
    setAutomationMode(nextMode);
    setAutomations(syncClientAutomations(contacts, nextMode));
  }

  function applyUpdate(id: string, changes: Partial<Pick<ClientAutomation, "message" | "scheduledFor" | "status">>) {
    updateClientAutomation(id, changes);
    setAutomations(getClientAutomations());
  }

  const filtered = automations.filter((automation) =>
    (typeFilter === "all" || automation.type === typeFilter) &&
    (statusFilter === "all" || automation.status === statusFilter) &&
    (!dateFilter || automation.scheduledFor.slice(0, 10) === dateFilter)
  );
  const incomplete = contacts.filter((contact) => getCommunicationBlockReason(contact) || contact.importProfile?.missingInformation.length);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Coach IA</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Automatisations clients</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Les employés IA préparent et planifient les communications. Les anniversaires admissibles peuvent être envoyés automatiquement par courriel.</p>
        </div>
        <label className="text-sm font-semibold">
          Mode automatisation
          <select value={mode} onChange={(event) => changeMode(event.target.value as AutomationMode)} className="mt-2 block rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950">
            <option value="disabled">Désactivé</option>
            <option value="approval">Validation requise</option>
            <option value="automatic">Automatique (planification seulement)</option>
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-900 dark:bg-teal-950/20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">Anniversaires</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Détection quotidienne, consentement vérifié et un seul envoi réel par contact et par année.</p>
          </div>
          <p className="text-xs font-semibold text-teal-800 dark:text-teal-200">Prochain : {birthdayStatus.nextBirthday ? `${birthdayStatus.nextBirthday.name} · ${birthdayStatus.nextBirthday.date}` : "Aucun"}</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Aujourd’hui", birthdayStatus.birthdaysToday],
            ["Envoyés", birthdayStatus.sent],
            ["Bloqués", birthdayStatus.blocked],
            ["Courriels manquants", birthdayStatus.missingEmails],
            ["Consentements manquants", birthdayStatus.missingConsents],
          ].map(([label, value]) => <div key={label} className="rounded-lg bg-white p-3 ring-1 ring-teal-200 dark:bg-slate-950 dark:ring-teal-900"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}
        </div>
        <details className="mt-4 rounded-lg border border-teal-200 bg-white p-4 dark:border-teal-900 dark:bg-slate-950">
          <summary className="cursor-pointer text-sm font-semibold">Tester avec un contact</summary>
          <p className="mt-2 text-xs text-slate-500">Le serveur force uniquement ce contact à aujourd’hui et envoie exclusivement à BIRTHDAY_TEST_EMAIL. La fiche réelle n’est pas modifiée.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select value={birthdayContactId} onChange={(event) => setBirthdayContactId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Choisir un contact</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select>
            <input type="email" value={birthdayTestEmail} onChange={(event) => setBirthdayTestEmail(event.target.value)} placeholder="Adresse de test autorisée" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            <select value={birthdayTone} onChange={(event) => setBirthdayTone(event.target.value as "chaleureux" | "professionnel" | "amical")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="chaleureux">Chaleureux</option>
              <option value="professionnel">Professionnel</option>
              <option value="amical">Amical</option>
            </select>
          </div>
          <button type="button" disabled={birthdayTestRunning} onClick={testBirthday} className="mt-3 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{birthdayTestRunning ? "Envoi du test…" : "Envoyer uniquement le test"}</button>
          {birthdayTestResult ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900">{birthdayTestResult}</p> : null}
        </details>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["À venir", summary.upcoming],
          ["Prêtes", summary.ready],
          ["En retard", summary.overdue],
          ["Envoyées", summary.sent],
          ["Erreurs", summary.errors],
          ["Interventions humaines", summary.humanInterventions],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AutomationType | "all")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="all">Tous les types</option>
          {Object.entries(AUTOMATION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AutomationStatus | "all")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="all">Tous les statuts</option>
          {["brouillon", "planifiée", "prête", "envoyée", "échouée", "annulée", "ignorée"].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        <button type="button" onClick={() => setAutomations(syncClientAutomations(contacts, mode))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">Analyser les fiches</button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
          {filtered.length ? filtered.map((automation) => {
            const overdue = automation.scheduledFor.slice(0, 10) < today && !["envoyée", "annulée", "ignorée"].includes(automation.status);
            return (
              <button key={automation.id} type="button" onClick={() => setSelectedId(automation.id)} className={cn("w-full rounded-lg border p-4 text-left", selectedId === automation.id ? "border-teal-400 bg-teal-50 dark:bg-teal-950/30" : "border-slate-200 dark:border-slate-800")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{automation.clientName} · {AUTOMATION_TYPE_LABELS[automation.type]}</p>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200")}>{overdue ? "en retard" : automation.status}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{automation.employee} · {automation.channel} · {new Date(automation.scheduledFor).toLocaleString("fr-CA")}</p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{automation.reason}</p>
              </button>
            );
          }) : <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">Aucune automatisation pour ces filtres.</p>}
        </div>

        {selected ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Automatisation ouverte</p>
            <h3 className="mt-1 font-semibold">{selected.clientName} · {AUTOMATION_TYPE_LABELS[selected.type]}</h3>
            <p className="mt-2 text-xs text-slate-500">{selected.reason}</p>
            <label className="mt-4 block text-xs font-semibold">Date prévue
              <input type="datetime-local" value={selected.scheduledFor.slice(0, 16)} onChange={(event) => applyUpdate(selected.id, { scheduledFor: new Date(event.target.value).toISOString() })} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="mt-3 block text-xs font-semibold">Message préparé
              <textarea rows={8} value={selected.message} onChange={(event) => applyUpdate(selected.id, { message: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <p className="mt-3 text-xs"><span className="font-semibold">Prochaine action :</span> {selected.nextAction}</p>
            <Link href={selected.clientHref} className="mt-3 inline-flex text-xs font-semibold text-teal-700 underline">Ouvrir la fiche client</Link>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => applyUpdate(selected.id, { status: "brouillon" })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Mettre en pause</button>
              <button type="button" onClick={() => applyUpdate(selected.id, { status: "annulée" })} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700">Annuler</button>
              <button type="button" onClick={() => applyUpdate(selected.id, { status: "ignorée" })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Ignorer</button>
              <button type="button" onClick={() => applyUpdate(selected.id, { status: selected.scheduledFor.slice(0, 10) <= today ? "prête" : "planifiée" })} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Réactiver</button>
            </div>
          </div>
        ) : <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">Ouvrez une automatisation pour modifier son message, sa date ou son statut.</div>}
      </div>

      {incomplete.length ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Contacts incomplets ou exclus</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incomplete.map((contact) => <span key={contact.id} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-amber-200 dark:bg-slate-950 dark:ring-amber-900">{contact.name} · {getCommunicationBlockReason(contact) || contact.importProfile?.missingInformation.join(", ")}</span>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TodayCard({ data, empty = false }: { data: PipelineDashboardData; empty?: boolean }) {
  const metrics = [
    ["Prospects", data.today.prospects],
    ["Évaluations", data.today.evaluations],
    ["Mandats", data.today.mandates],
    ["Notaire", data.today.notary],
    ["Suivis", data.today.followUps],
  ].map(([label, value]) => [label, empty ? 0 : value]);


  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <CalendarCheck className="h-4 w-4 text-teal-600" />
        Aujourd&apos;hui
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineLane({
  title,
  icon: Icon,
  statuses,
  clients,
  selectedId,
  onSelect,
}: {
  title: string;
  icon: typeof Home;
  statuses: PipelineStatus[];
  clients: PipelineClient[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
            <Icon className="h-4 w-4" />
            {title}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Statuts et clients actifs</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {statuses.map((status) => {
          const statusClients = clients.filter((client) => client.status === status);
          return (
            <div key={status} className="min-h-36 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold leading-snug">{status}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">{statusClients.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {statusClients.length ? (
                  statusClients.map((client) => (
                    <button
                      type="button"
                      key={client.id}
                      onClick={() => onSelect(client.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition",
                        selectedId === client.id
                          ? "border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-50"
                          : "border-slate-200 bg-white hover:border-teal-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-900",
                      )}
                    >
                      <p className="text-sm font-semibold">{client.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{client.address || client.city}</p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400 dark:border-slate-800">Aucun client</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ClientPanel({
  client,
  importProfile,
  activeActions,
}: {
  client: PipelineClient;
  importProfile?: ClientImportProfile;
  activeActions: Array<PipelineClient["actions"][number] & { client: PipelineClient }>;
}) {
  const [callStatus, setCallStatus] = useState("");
  const aiContext = contextFromPipelineStatus(client.status, client.type);
  const recommendedActions = getContextualAiActions(aiContext);

  async function startClientCall() {
    setCallStatus("Assurez-vous d'avoir les consentements requis pour enregistrer et analyser cet appel.");
    const response = await fetch("/api/calls/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "+15145550123", clientId: client.id, recordingEnabled: true, provider: "twilio" }),
    });
    const payload = (await response.json()) as { message?: string; error?: string };
    setCallStatus(payload.error || payload.message || "Appel lancé.");
  }

  return (
    <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Fiche client</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{client.name}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{client.address ? `${client.address}, ${client.city}` : client.city}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{client.status}</Badge>
          <PriorityBadge priority={client.priority} />
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prochaine étape</p>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{client.nextStep}</p>
        </div>
        {importProfile ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900 dark:bg-teal-950/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">Automatisations admissibles</p>
              <p className="mt-2 text-sm">{importProfile.automationEligible.length ? importProfile.automationEligible.join(" · ") : "Aucune pour le moment"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Informations manquantes</p>
              <p className="mt-2 text-sm">{importProfile.missingInformation.length ? importProfile.missingInformation.join(" · ") : "Fiche suffisamment complète"}</p>
              <p className="mt-3 text-xs text-slate-500">Dernier contact : {importProfile.lastContact || "Non renseigné"}</p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={startClientCall}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          <Phone className="h-4 w-4" />
          Appeler avec IACourtier
        </button>
        {callStatus ? <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{callStatus}</p> : null}
      </section>

      <section className="rounded-lg border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
          <Sparkles className="h-4 w-4" />
          Actions IA recommandées
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300">{aiContext}</p>
        <div className="mt-4 space-y-3">
          {recommendedActions.map((action) => (
            <div key={action.id} className="rounded-lg border border-teal-200/80 bg-white p-4 dark:border-teal-900 dark:bg-slate-950/45">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{action.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{action.description}</p>
                </div>
                {action.primary ? <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-900/60 dark:text-teal-100">Prioritaire</span> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {action.outputs.slice(0, 4).map((output) => (
                  <span key={output} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {output}
                  </span>
                ))}
                {action.outputs.length > 4 ? <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 dark:border-slate-700">+{action.outputs.length - 4}</span> : null}
              </div>
              {action.href ? (
                <Link
                  href={action.href}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                >
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
          <Bot className="h-4 w-4" />
          Employés IA déclenchés
        </p>
        <div className="mt-4 space-y-3">
          {activeActions.map((action) => (
            <div key={action.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{getEmployeeName(action.employeeId)} · {action.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{action.description}</p>
                </div>
                <StatusBadge status={action.status} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
          <Clock3 className="h-4 w-4" />
          Timeline complète
        </p>
        <div className="mt-5 space-y-4">
          {client.timeline.map((event) => (
            <div key={event.id} className="relative border-l border-slate-200 pl-4 dark:border-slate-800">
              <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-teal-600 ring-4 ring-white dark:ring-slate-900" />
              <p className="text-sm font-semibold">{event.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.date}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{event.description}</p>
              {event.employeeId ? <p className="mt-2 text-xs font-semibold text-teal-700 dark:text-teal-300">{getEmployeeName(event.employeeId)} travaille dessus</p> : null}
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Badge({ children }: { children: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-900">{children}</span>;
}

function PriorityBadge({ priority }: { priority: PipelineClient["priority"] }) {
  const className =
    priority === "Élevée"
      ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900"
      : priority === "Moyenne"
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900"
        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";

  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", className)}>{priority}</span>;
}

function StatusBadge({ status }: { status: PipelineClient["actions"][number]["status"] }) {
  const Icon = status === "Terminé" ? CheckCircle2 : status === "En cours" ? ArrowRight : FileText;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}
