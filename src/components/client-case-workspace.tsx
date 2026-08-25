"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, FileText, Home, LockKeyhole, Loader2, MapPin, Sparkles, UserRound } from "lucide-react";

import { SessionStatusNotice, useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { UniversalDocumentImporter } from "@/components/universal-document-importer";
import { canonicalCrmStage, crmPipelineStages, type CrmPipelineType } from "@/lib/crm-operating-system";

type Payload = {
  case: Record<string, any>;
  clients: Array<Record<string, any>>;
  caseRoles: Array<Record<string, any>>;
  documents: Array<Record<string, any>>;
  tasks: Array<Record<string, any>>;
  automations: Array<Record<string, any>>;
  communications: Array<Record<string, any>>;
  appointments: Array<Record<string, any>>;
  activity: Array<Record<string, any>>;
  buyer?: Record<string, any> | null;
  seller?: Record<string, any> | null;
  financing?: Record<string, any> | null;
  partners: Array<Record<string, any>>;
  addresses: Array<Record<string, any>>;
  facts: Array<Record<string, any>>;
  conflicts: Array<Record<string, any>>;
  requirements: Array<Record<string, any>>;
  crmEvents: Array<Record<string, any>>;
  dependencies: Array<Record<string, any>>;
};

export function ClientCaseWorkspace({ caseId, importCompleted = false, addDocument = false }: { caseId: string; importCompleted?: boolean; addDocument?: boolean }) {
  const { status, authenticatedFetch } = useDashboardAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/client-cases/${caseId}`, { cache: "no-store" });
      const payload = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
      setData(payload);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible."); }
    finally { setLoading(false); }
  }, [authenticatedFetch, caseId, status]);

  useEffect(() => { void load(); }, [load]);

  async function update(target: "task" | "automation", id: string, nextStatus: string) {
    setSavingId(id);
    try {
      const response = await authenticatedFetch(`/api/client-cases/${caseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, id, status: nextStatus }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Modification impossible.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Modification impossible."); }
    finally { setSavingId(""); }
  }

  const primary = useMemo(() => data?.clients.find((item) => item.id === data.case.primary_client_id) || data?.clients[0], [data]);
  if (loading || !data) return <div className="flex min-h-96 items-center justify-center">{error ? <p className="text-red-700">{error}</p> : <Loader2 className="h-8 w-8 animate-spin text-teal-700" />}</div>;
  const item = data.case;
  const missing = data.requirements?.length
    ? data.requirements.filter((requirement) => requirement.status === "missing" || requirement.status === "to_verify").map((requirement) => requirement.label)
    : missingInformation(data);
  const pendingConflicts = data.conflicts.filter((conflict) => conflict.status === "pending");
  const pendingReviewTasks = data.tasks.filter((task) => task.status === "pending" && task.category === "review");
  const reviewTaskLabels = new Set(pendingReviewTasks.map((task) => String(task.title).replace(/^À vérifier — /, "")));
  const unqueuedMissing = missing.filter((item) => !reviewTaskLabels.has(item));
  const reviewCount = pendingConflicts.length + pendingReviewTasks.length + unqueuedMissing.length;
  const specializedHref = data.buyer ? `/tableau-de-bord/acheteurs/${data.buyer.id}` : data.seller ? `/tableau-de-bord/inscriptions/${data.seller.id}` : null;
  const continueHref = reviewCount ? "#a-verifier" : specializedHref || "#parcours";
  const continueLabel = reviewCount ? "Vérifier les éléments signalés" : item.next_action || "Continuer le dossier";
  const pipelineType = (item.pipeline_type || item.case_type) as CrmPipelineType;
  const currentStage = canonicalCrmStage(pipelineType, item.current_stage || item.pipeline_stage);
  const pipelineStages = crmPipelineStages(pipelineType);
  const currentStageIndex = pipelineStages.findIndex((stage) => stage.id === currentStage);

  return <div className="space-y-6">
    <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link href="/tableau-de-bord/clients" className="hover:text-teal-700">Clients & dossiers</Link><span>›</span>{primary ? <Link href={`/tableau-de-bord/clients/${primary.id}`} className="hover:text-teal-700">{clientName(primary)}</Link> : <span>Client</span>}<span>›</span><span>{item.title}</span></nav>
    {importCompleted ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100" role="status"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><strong>Import terminé — dossier complet à {item.completion_score ?? 0} %</strong><p className="mt-1 text-sm">{data.documents.length} document{data.documents.length > 1 ? "s" : ""} classé{data.documents.length > 1 ? "s" : ""}, {data.clients.length} client{data.clients.length > 1 ? "s" : ""} relié{data.clients.length > 1 ? "s" : ""}{reviewCount ? ` et ${reviewCount} élément${reviewCount > 1 ? "s" : ""} non bloquant${reviewCount > 1 ? "s" : ""} à vérifier` : " et aucune ambiguïté bloquante"}.</p></div></div></section> : null}
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-semibold text-teal-700">Dossier {caseType(item.case_type)}</p><h1 className="mt-2 text-3xl font-semibold">{item.title}</h1><p className="mt-2 text-slate-500">Étape actuelle : <strong className="text-slate-900 dark:text-white">{pipelineStages[currentStageIndex]?.label || label(currentStage)}</strong></p></div><div className="min-w-64 rounded-2xl bg-teal-50 p-4 text-teal-950 dark:bg-teal-950 dark:text-teal-50"><p className="text-xs font-bold uppercase tracking-wide">Prochaine action</p><p className="mt-2 font-semibold">{continueLabel}</p>{item.next_action_reason ? <p className="mt-1 text-xs text-teal-800 dark:text-teal-200">{item.next_action_reason}</p> : null}<a href={continueHref} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-teal-700 dark:text-teal-300">Continuer <ArrowRight className="h-4 w-4" /></a></div></div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-teal-600" style={{ width: `${item.pipeline_progress ?? item.progress ?? 0}%` }} /></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{label(item.status)}</span><span>{item.pipeline_progress ?? item.progress ?? 0}% du pipeline</span></div>
    </header>
    <SessionStatusNotice />{error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric title="Progression" value={`${item.pipeline_progress ?? item.progress ?? 0} %`} /><Metric title="Complétude" value={`${item.completion_score ?? 0} %`} /><Metric title="Santé du dossier" value={`${item.health_score ?? 100} %`} /><Metric title="Priorité" value={`${item.priority_score ?? 0} / 100`} />
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">Pipeline central</p><h2 className="mt-1 text-lg font-semibold">Parcours {caseType(item.case_type)}</h2></div><span className="text-sm text-slate-500">Étape {Math.max(1, currentStageIndex + 1)} sur {pipelineStages.length}</span></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{pipelineStages.map((stage, index) => <div key={stage.id} className={`rounded-xl border p-3 text-sm ${index === currentStageIndex ? "border-teal-600 bg-teal-50 text-teal-950 dark:bg-teal-950/30 dark:text-teal-100" : index < currentStageIndex ? "border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100" : "border-slate-200 text-slate-500 dark:border-slate-800"}`}><span className="text-xs font-bold">{index + 1}</span><strong className="ml-2">{stage.label}</strong></div>)}</div></section>

    <section id="a-verifier" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30"><h2 className="font-semibold text-amber-950 dark:text-amber-100">À vérifier — sans bloquer le dossier</h2>{reviewCount ? <div className="mt-3 grid gap-2 md:grid-cols-2">{unqueuedMissing.map((value) => <p key={`missing-${value}`} className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200"><Circle className="h-3 w-3" />{value}</p>)}{pendingConflicts.map((conflict) => <p key={conflict.id} className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200"><Circle className="h-3 w-3" />{conflict.label} : {conflict.current_value} → {conflict.proposed_value}</p>)}{pendingReviewTasks.map((task) => <p key={task.id} className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200"><Circle className="h-3 w-3" />{String(task.title).replace(/^À vérifier — /, "")}</p>)}</div> : <p className="mt-3 text-sm text-amber-900 dark:text-amber-200">Les renseignements essentiels sont présents et aucune contradiction n’attend de décision.</p>}{specializedHref ? <Link href={specializedHref} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-950 px-4 py-2 text-sm font-semibold text-white dark:bg-amber-100 dark:text-amber-950">Ouvrir les détails du parcours <ArrowRight className="h-4 w-4" /></Link> : null}</section>

    <details id="ajouter-source" open={addDocument} className="group rounded-3xl border border-teal-200 bg-teal-50/60 p-5 dark:border-teal-900 dark:bg-teal-950/20"><summary className="cursor-pointer list-none font-semibold text-teal-950 dark:text-teal-100">+ Ajouter un document, une pièce d’identité ou une conversation</summary><div className="mt-6 border-t border-teal-200 pt-6 dark:border-teal-900"><UniversalDocumentImporter caseId={caseId} caseTitle={item.title} /></div></details>

    <div id="parcours" className="grid gap-6 xl:grid-cols-2">
      <Panel title="Client et propriété" empty="Aucun client relié.">{data.clients.map((client) => <Link key={client.id} href={`/tableau-de-bord/clients/${client.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800"><span className="inline-flex items-center gap-3"><UserRound className="h-5 w-5 text-teal-700" /><span><strong className="block">{clientName(client)}</strong><span className="text-xs text-slate-500">{client.email || client.phone || "Coordonnées à compléter"}</span></span></span><ArrowRight className="h-4 w-4" /></Link>)}{item.property ? <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><Home className="h-5 w-5 text-teal-700" /><span><strong className="block">{property(item.property)?.address}</strong><span className="text-xs text-slate-500">{[property(item.property)?.city, property(item.property)?.property_type].filter(Boolean).join(" · ")}</span></span></div> : null}</Panel>
      <Panel title="Financement et partenaires" empty="Aucun renseignement financier ou partenaire.">{data.financing ? <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950"><Datum label="Statut" value={label(data.financing.status)} /><Datum label="Budget maximal" value={money(data.financing.maximum_purchase_price)} /><Datum label="Mise de fonds" value={money(data.financing.down_payment)} /><Datum label="Hypothèque" value={money(data.financing.mortgage_amount)} /></div> : null}{data.partners.map((row, index) => { const partner = Array.isArray(row.partner) ? row.partner[0] : row.partner; return <div key={partner?.id || index} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800"><strong>{clientName(partner || {})}</strong><p className="text-slate-500">{partner?.organization || label(row.role)}</p></div>; })}</Panel>
      <Panel title="Tâches" empty="Aucune tâche.">{data.tasks.map((task) => <button key={task.id} type="button" disabled={savingId === task.id} onClick={() => update("task", task.id, task.status === "completed" ? "pending" : "completed")} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left dark:border-slate-800">{savingId === task.id ? <Loader2 className="h-5 w-5 animate-spin" /> : task.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-teal-700" /> : <Circle className="h-5 w-5 text-slate-400" />}<span><strong className={task.status === "completed" ? "line-through opacity-60" : ""}>{task.title}</strong><span className="block text-xs text-slate-500">{label(task.category)}{task.due_at ? ` · ${date(task.due_at)}` : ""}</span></span></button>)}</Panel>
      <Panel title="Documents" empty="Aucun document classé.">{data.documents.map((document) => <div key={document.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">{document.is_sensitive ? <LockKeyhole className="h-5 w-5 text-amber-700" /> : <FileText className="h-5 w-5 text-teal-700" />}<span><strong className="block text-sm">{document.name}</strong><span className="text-xs text-slate-500">{document.category} · {label(document.analysis_status)}{document.is_sensitive ? " · accès restreint" : ""}</span></span></div>)}</Panel>
      <Panel title="Adresses des clients" empty="Aucune adresse personnelle ou postale distincte.">{data.addresses.map((address) => <div key={address.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><MapPin className="mt-0.5 h-5 w-5 text-teal-700" /><span><strong className="block text-sm">{address.address_line}</strong><span className="text-xs text-slate-500">{label(address.address_type)}{address.is_primary ? " · principale" : ""} · source : {address.source_label}</span></span></div>)}</Panel>
      <Panel title="Informations et provenance" empty="Aucune information extraite.">{data.facts.slice(0, 12).map((fact) => <div key={fact.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="flex items-start justify-between gap-3"><strong>{fact.label}</strong><span className={`rounded-full px-2 py-0.5 text-xs ${fact.status === "confirmed" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{label(fact.status)}</span></div><p className="mt-1">{fact.value_text}</p><p className="mt-1 text-xs text-slate-500">{fact.source_label} · confiance {fact.confidence == null ? "à confirmer" : `${Math.round(Number(fact.confidence) * 100)} %`}</p></div>)}</Panel>
      <Panel title="Conflits de données" empty="Aucun conflit de données.">{data.conflicts.map((conflict) => <div key={conflict.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"><strong>{conflict.label}</strong><p className="mt-1">{conflict.current_value} → {conflict.proposed_value}</p><p className="mt-1 text-xs">{label(conflict.status)}{conflict.resolution ? ` · ${label(conflict.resolution)}` : " · validation requise"}</p></div>)}</Panel>
      <Panel title="Automatisations proposées" empty="Aucune automatisation proposée.">{data.automations.map((automation) => <div key={automation.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><span className="inline-flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-600" />{automation.name}</span><button type="button" disabled={savingId === automation.id} onClick={() => update("automation", automation.id, automation.status === "approved" ? "disabled" : "approved")} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">{savingId === automation.id ? "…" : label(automation.status)}</button></div>)}</Panel>
      <Panel title="Exigences du dossier" empty="Aucune exigence calculée.">{data.requirements.map((requirement) => <div key={requirement.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">{requirement.status === "complete" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-amber-600" />}<span><strong className="block text-sm">{requirement.label}</strong><span className="text-xs text-slate-500">{requirement.status === "complete" ? "Complet" : "À compléter"} · {label(requirement.required_for_stage)}</span></span></div>)}</Panel>
      <Panel title="Historique" empty="Aucun événement.">{[...data.crmEvents.map((event) => ({ id: `crm-${event.id}`, title: eventTitle(event.event_type), created_at: event.occurred_at, details: event.from_stage && event.to_stage ? `${label(event.from_stage)} → ${label(event.to_stage)}` : "" })), ...data.activity].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 100).map((event) => <div key={event.id} className="border-l-2 border-teal-200 pl-4"><strong className="block text-sm">{event.title}</strong><span className="text-xs text-slate-500">{date(event.created_at)}</span>{event.details ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.details}</p> : null}</div>)}</Panel>
    </div>
  </div>;
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { const count = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0; return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-4 space-y-3">{count ? children : <p className="text-sm text-slate-500">{empty}</p>}</div></section>; }
function Metric({ title, value }: { title: string; value: number | string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>; }
function Datum({ label: key, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{key}</p><p className="font-semibold">{value}</p></div>; }
function property(value: any) { return Array.isArray(value) ? value[0] : value; }
function clientName(value: Record<string, any>) { return `${value.first_name || ""} ${value.last_name || ""}`.trim() || "Personne à identifier"; }
function label(value?: string) { return (value || "").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function caseType(value: string) { return ({ buyer: "acheteur", seller: "vendeur", buy_sell: "acheteur + vendeur", prospect: "prospect", renewal: "renouvellement", post_transaction: "après-vente", other: "autre" } as Record<string, string>)[value] || label(value); }
function date(value: string) { return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(new Date(value)); }
function money(value: number | null | undefined) { return value == null ? "À confirmer" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value); }
function missingInformation(data: Payload) { const missing: string[] = []; for (const client of data.clients) { const name = clientName(client); if (!client.email) missing.push(`Courriel manquant — ${name}`); if (!client.phone) missing.push(`Téléphone manquant — ${name}`); } if (data.buyer) { if (!data.buyer.budget && !data.financing?.maximum_purchase_price) missing.push("Budget maximal manquant"); if (!data.buyer.sectors?.length) missing.push("Secteurs recherchés manquants"); if (!data.buyer.property_type) missing.push("Type de propriété recherché manquant"); if (!data.buyer.timeline) missing.push("Échéancier manquant"); if (!data.financing || data.financing.status === "missing") missing.push("Préqualification hypothécaire manquante"); } if (data.seller && !data.case.property_id) missing.push("Propriété à vendre manquante"); return [...new Set(missing)]; }
function eventTitle(value: string) { return ({ document_uploaded: "Document téléversé", document_ingestion_completed: "Analyse documentaire terminée", client_created: "Dossier central créé", pipeline_stage_changed: "Étape du pipeline modifiée", mandate_signed: "Mandat signé", offer_accepted: "Offre acceptée", condition_due: "Échéance de condition", transaction_closed: "Transaction clôturée" } as Record<string, string>)[value] || label(value); }

