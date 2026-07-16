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
import { getSoniaProspects } from "@/lib/sonia-beta/storage";
import type { ClientImportProfile, ClientRelationshipType, SoniaProspect } from "@/lib/sonia-beta/types";
import {
  IMPORT_FIELD_LABELS,
  RELATIONSHIP_LABELS,
  findDuplicates,
  getImportStatistics,
  importClientRows,
  parseClientCsv,
  type ColumnMapping,
  type DuplicateDecision,
  type ImportPreview,
  type ImportReport,
} from "@/lib/client-import";

export function IntelligentPipelineDashboard({ data }: { data: PipelineDashboardData }) {
  const [selectedId, setSelectedId] = useState(data.clients[0]?.id || "");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [storedContacts, setStoredContacts] = useState<SoniaProspect[]>([]);

  function refreshStoredContacts() {
    setStoredContacts(getSoniaProspects().filter((contact) => !contact.id.startsWith("sonia-demo-")));
  }

  useEffect(() => {
    refreshStoredContacts();
  }, []);

  const importedClients = useMemo(() => storedContacts.map(toPipelineClient), [storedContacts]);
  const clients = useMemo(() => {
    const importedIds = new Set(importedClients.map((client) => client.id));
    return [...importedClients, ...data.clients.filter((client) => !importedIds.has(client.id))];
  }, [data.clients, importedClients]);
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

          <TodayCard data={data} />
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsImportOpen((current) => !current)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          <Upload className="h-4 w-4" />
          Importer mes clients
        </button>
      </div>

      {isImportOpen ? <ClientImportPanel onImported={refreshStoredContacts} /> : null}

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
  const [decisions, setDecisions] = useState<Record<number, DuplicateDecision>>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setReport(null);
    setDecisions({});

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setPreview(null);
      setError("Choisissez un fichier CSV ou un export CRM au format CSV.");
      return;
    }

    try {
      setPreview(parseClientCsv(await file.text()));
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
    setDecisions({});
    setReport(null);
  }

  function updateRelationship(rowNumber: number, relationshipType: ClientRelationshipType) {
    setPreview((current) => current ? {
      ...current,
      rows: current.rows.map((row) => row.rowNumber === rowNumber ? { ...row, relationshipType } : row),
    } : current);
  }

  if (!preview) {
    return (
      <section className="rounded-lg border border-teal-200 bg-teal-50/60 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/20">
        <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">Importer mes clients</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sélectionnez un CSV. Aucun courriel ni texto ne sera envoyé.</p>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="mt-4 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2.5 file:font-semibold file:text-white dark:file:bg-white dark:file:text-slate-950" />
        {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      </section>
    );
  }

  const statistics = getImportStatistics(preview.rows, preview.mapping);
  const duplicates = findDuplicates(preview.rows, preview.mapping, getSoniaProspects());
  const unresolvedDuplicates = duplicates.filter((duplicate) => !decisions[duplicate.rowNumber]);

  function confirmImport() {
    if (unresolvedDuplicates.length) {
      setError("Choisissez fusionner, conserver les deux ou ignorer pour chaque doublon.");
      return;
    }
    const result = importClientRows(preview.rows, preview.mapping, decisions);
    setReport(result);
    setError("");
    onImported();
  }

  return (
    <section className="space-y-5 rounded-lg border border-teal-200 bg-white p-5 shadow-sm dark:border-teal-900 dark:bg-slate-900/72">
      <div>
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Aperçu de l’import</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Vérifiez les associations et le type de chaque contact avant de confirmer.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Contacts détectés", statistics.contacts],
          ["Doublons possibles", statistics.duplicates],
          ["Courriels manquants", statistics.missingEmails],
          ["Téléphones manquants", statistics.missingPhones],
          ["Renouvellements manquants", statistics.missingMortgageRenewals],
          ["Naissances manquantes", statistics.missingBirthDates],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Association des colonnes</h3>
        {preview.uncertainHeaders.length ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Certaines colonnes demandent votre confirmation.</p> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {preview.headers.map((header) => (
            <label key={header} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <span className="mb-2 block font-semibold">{header}</span>
              <select
                value={preview.mapping[header]}
                onChange={(event) => updateMapping(header, event.target.value as ColumnMapping[string])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {Object.entries(IMPORT_FIELD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <h3 className="text-sm font-semibold">Contacts à importer</h3>
        <table className="mt-3 min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr><th className="p-2">Ligne</th><th className="p-2">Aperçu</th><th className="p-2">Type</th><th className="p-2">Doublon</th></tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => {
              const duplicate = duplicates.find((item) => item.rowNumber === row.rowNumber);
              const values = Object.values(row.values).filter(Boolean).slice(0, 3).join(" · ");
              return (
                <tr key={row.rowNumber} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-2">{row.rowNumber}</td>
                  <td className="max-w-sm p-2">{values || "Ligne vide"}</td>
                  <td className="p-2">
                    <select
                      value={row.relationshipType}
                      onChange={(event) => updateRelationship(row.rowNumber, event.target.value as ClientRelationshipType)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                    >
                      {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    {duplicate ? (
                      <div>
                        <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">{duplicate.existingName} · {duplicate.reasons.join(", ")}</p>
                        <select
                          value={decisions[row.rowNumber] || ""}
                          onChange={(event) => setDecisions((current) => ({ ...current, [row.rowNumber]: event.target.value as DuplicateDecision }))}
                          className="rounded-lg border border-amber-300 bg-white px-2 py-2 dark:bg-slate-950"
                        >
                          <option value="">Choisir…</option>
                          <option value="merge">Fusionner sans écraser</option>
                          <option value="keep-both">Conserver les deux</option>
                          <option value="ignore">Ignorer</option>
                        </select>
                      </div>
                    ) : <span className="text-xs text-slate-500">Aucun</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}

      <button type="button" onClick={confirmImport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">
        <Upload className="h-4 w-4" />
        Confirmer l’import
      </button>

      {report ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 text-sm dark:border-teal-900 dark:bg-teal-950/30">
          <p className="font-semibold">Import terminé</p>
          <p className="mt-2">Contacts importés : {report.imported} · Doublons : {report.duplicates} · Lignes ignorées : {report.ignored} · Erreurs : {report.errors.length}</p>
          <p className="mt-1">Prêts pour automatisation : {report.readyForAutomation} · Contacts à compléter : {report.contactsToComplete}</p>
          {report.errors.length ? <ul className="mt-2 list-disc pl-5">{report.errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}
        </div>
      ) : null}
    </section>
  );
}

function TodayCard({ data }: { data: PipelineDashboardData }) {
  const metrics = [
    ["Prospects", data.today.prospects],
    ["Évaluations", data.today.evaluations],
    ["Mandats", data.today.mandates],
    ["Notaire", data.today.notary],
    ["Suivis", data.today.followUps],
  ];

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
