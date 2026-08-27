"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Columns3, FilePlus2, LayoutList, Loader2, RefreshCw, Sparkles, Target } from "lucide-react";

import { SessionStatusNotice, useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { ClientQuickPanel, type QuickClient } from "@/components/client-quick-panel";
import { canonicalCrmStage, crmPipelineStages, type CrmPipelineMode, type CrmPipelineType, type CrmStageDefinition } from "@/lib/crm-operating-system";

type PipelineCase = {
  id: string;
  title: string;
  case_type: CrmPipelineType;
  pipeline_type?: CrmPipelineType;
  current_stage: string;
  pipeline_stage: string;
  pipeline_mode?: CrmPipelineMode;
  pipeline_progress?: number;
  completion_score?: number;
  health_score?: number;
  priority_score?: number;
  priority_level?: string;
  next_action?: string;
  next_best_action?: string;
  next_action_reason?: string;
  suggested_stage?: string | null;
  suggested_stage_reason?: string | null;
  suggestion_confidence?: number | null;
  alerts?: Array<{ code: string; level: string; title: string; detail: string; dueAt?: string | null }>;
  missing_items?: string[];
  clients: Array<QuickClient & { role?: string }>;
  property?: { address?: string; city?: string; property_type?: string } | Array<{ address?: string; city?: string; property_type?: string }> | null;
  dependencies?: Array<Record<string, unknown>>;
  conditions?: Array<{ id: string; title: string; status: string; due_at?: string | null }>;
};

type Payload = {
  cases: PipelineCase[];
  stages: { seller: CrmStageDefinition[]; buyer: CrmStageDefinition[]; post_transaction: CrmStageDefinition[] };
  error?: string;
};

type View = "kanban" | "list" | "priority";
type Family = "seller" | "buyer" | "post_transaction";

export function CentralPipelineDashboard() {
  const { status, authenticatedFetch } = useDashboardAuth();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("kanban");
  const [family, setFamily] = useState<Family>("seller");

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const response = await authenticatedFetch("/api/crm/pipeline", { cache: "no-store" });
      const data = await response.json() as Payload;
      if (!response.ok) throw new Error(data.error || "Le pipeline n’a pas pu être chargé.");
      setPayload(data); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Le pipeline n’a pas pu être chargé."); }
    finally { setLoading(false); }
  }, [authenticatedFetch, status]);

  useEffect(() => { void load(); }, [load]);

  const familyCases = useMemo(() => (payload?.cases || []).filter((item) => pipelineFamily(item) === family), [family, payload]);
  const orderedCases = useMemo(() => [...familyCases].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0)), [familyCases]);
  const stages = payload?.stages[family] || crmPipelineStages(family);
  const counts = useMemo(() => ({ seller: (payload?.cases || []).filter((item) => pipelineFamily(item) === "seller").length, buyer: (payload?.cases || []).filter((item) => pipelineFamily(item) === "buyer").length, post_transaction: (payload?.cases || []).filter((item) => pipelineFamily(item) === "post_transaction").length }), [payload]);
  const critical = (payload?.cases || []).filter((item) => item.priority_level === "critical" || (item.alerts || []).some((alert) => alert.level === "critical")).length;

  async function patchCase(item: PipelineCase, body: Record<string, unknown>) {
    setSaving(item.id); setError("");
    try {
      const response = await authenticatedFetch(`/api/client-cases/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "La modification n’a pas pu être enregistrée.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "La modification n’a pas pu être enregistrée."); }
    finally { setSaving(""); }
  }

  function changeStage(item: PipelineCase, target: string) {
    const itemStages = crmPipelineStages(item.pipeline_type || item.case_type);
    const previous = itemStages.findIndex((stage) => stage.id === canonicalCrmStage(item.pipeline_type || item.case_type, item.current_stage || item.pipeline_stage));
    const next = itemStages.findIndex((stage) => stage.id === target);
    let reason = "Étape confirmée depuis le pipeline";
    if (next < previous) {
      reason = window.prompt("Pourquoi ce dossier doit-il reculer? Cette raison sera conservée dans l’historique.", "")?.trim() || "";
      if (!reason) return;
    }
    void patchCase(item, { target: "case", pipelineStage: target, reason });
  }

  if (loading && !payload) return <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-700" /></div>;

  return <div className="mx-auto max-w-[1600px] space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-semibold text-teal-700">CRM central en temps réel</p><h1 className="mt-1 text-3xl font-semibold">Pipeline intelligent</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Chaque étape, alerte et prochaine action provient du dossier réel. Le mode assisté propose; le courtier confirme.</p></div>
      <div className="flex flex-wrap gap-2"><ViewButton active={view === "kanban"} icon={<Columns3 className="h-4 w-4" />} onClick={() => setView("kanban")}>Kanban</ViewButton><ViewButton active={view === "list"} icon={<LayoutList className="h-4 w-4" />} onClick={() => setView("list")}>Liste</ViewButton><ViewButton active={view === "priority"} icon={<Target className="h-4 w-4" />} onClick={() => setView("priority")}>Priorité</ViewButton><button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"><RefreshCw className="h-4 w-4" />Actualiser</button></div>
    </header>
    <SessionStatusNotice />
    {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Dossiers actifs" value={payload?.cases.length || 0} /><Summary label="Critiques" value={critical} tone={critical ? "critical" : "normal"} /><Summary label="Actions aujourd’hui" value={(payload?.cases || []).filter((item) => ["critical", "today"].includes(item.priority_level || "")).length} /><Summary label="Suggestions à confirmer" value={(payload?.cases || []).filter((item) => item.suggested_stage).length} /></section>

    <nav className="flex flex-wrap gap-2" aria-label="Type de parcours"><FamilyButton active={family === "seller"} onClick={() => setFamily("seller")}>Vendeurs ({counts.seller})</FamilyButton><FamilyButton active={family === "buyer"} onClick={() => setFamily("buyer")}>Acheteurs ({counts.buyer})</FamilyButton><FamilyButton active={family === "post_transaction"} onClick={() => setFamily("post_transaction")}>Après-vente ({counts.post_transaction})</FamilyButton></nav>

    {!familyCases.length ? <Empty family={family} /> : view === "kanban" ? <div className="overflow-x-auto pb-3"><div className="flex min-w-max gap-4">{stages.map((stage) => { const items = familyCases.filter((item) => canonicalCrmStage(item.pipeline_type || item.case_type, item.current_stage || item.pipeline_stage) === stage.id); return <section key={stage.id} className="w-80 shrink-0 rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-900/70"><header className="mb-3 flex items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Étape {stages.findIndex((item) => item.id === stage.id) + 1}</p><h2 className="mt-1 text-sm font-semibold">{stage.label}</h2></div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold dark:bg-slate-800">{items.length}</span></header><div className="space-y-3">{items.map((item) => <PipelineCard key={item.id} item={item} stages={stages} saving={saving === item.id} onStage={changeStage} onPatch={patchCase} />)}{!items.length ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-slate-700">Aucun dossier</p> : null}</div></section>; })}</div></div> : <div className="space-y-3">{orderedCases.map((item) => <PipelineCard key={item.id} item={item} stages={stages} saving={saving === item.id} onStage={changeStage} onPatch={patchCase} wide priority={view === "priority"} />)}</div>}
  </div>;
}

function PipelineCard({ item, stages, saving, onStage, onPatch, wide = false, priority = false }: { item: PipelineCase; stages: CrmStageDefinition[]; saving: boolean; onStage: (item: PipelineCase, stage: string) => void; onPatch: (item: PipelineCase, body: Record<string, unknown>) => Promise<void>; wide?: boolean; priority?: boolean }) {
  const client = item.clients?.[0]; const property = Array.isArray(item.property) ? item.property[0] : item.property; const current = canonicalCrmStage(item.pipeline_type || item.case_type, item.current_stage || item.pipeline_stage);
  const alerts = item.alerts || []; const critical = alerts.filter((alert) => alert.level === "critical");
  return <article className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950 ${critical.length ? "border-red-300 dark:border-red-900" : "border-slate-200 dark:border-slate-800"} ${wide ? "lg:grid lg:grid-cols-[1.2fr_.8fr_.7fr] lg:gap-5" : ""}`}>
    <div className="min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-teal-700">{caseType(item.case_type)} · {priorityLabel(item.priority_level)}</p><Link href={`/tableau-de-bord/dossiers/${item.id}`} className="mt-1 block truncate font-semibold hover:text-teal-700">{item.title}</Link></div><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold dark:bg-slate-800">{item.priority_score || 0}</span></div>
      {client ? <div className="mt-3"><ClientQuickPanel client={client} caseId={item.id} caseLabel={item.title} returnHref="/tableau-de-bord/pipeline" returnLabel="Pipeline" compact /></div> : <p className="mt-3 text-sm font-semibold text-red-700">Client à relier</p>}
      {property?.address ? <p className="mt-2 text-xs text-slate-500">{property.address}{property.city ? `, ${property.city}` : ""}</p> : null}
    </div>
    <div className={wide ? "mt-4 lg:mt-0" : "mt-4"}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Prochaine meilleure action</p><p className="mt-1 text-sm font-semibold">{item.next_best_action || item.next_action || "Continuer le dossier"}</p>{item.next_action_reason ? <p className="mt-1 text-xs text-slate-500">{item.next_action_reason}</p> : null}<div className="mt-3 flex gap-2"><Progress label="Pipeline" value={item.pipeline_progress || 0} /><Progress label="Prêt" value={item.completion_score || 0} /></div></div>
    <div className={wide ? "mt-4 lg:mt-0" : "mt-4"}>
      {alerts.length ? <div className="space-y-1">{alerts.slice(0, priority ? 4 : 2).map((alert) => <p key={alert.code} className={`flex gap-2 rounded-lg p-2 text-xs ${alert.level === "critical" ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"}`}><AlertTriangle className="h-4 w-4 shrink-0" /><span><strong>{alert.title}</strong><span className="block">{alert.detail}</span></span></p>)}</div> : <p className="text-xs text-emerald-700">Aucune alerte critique.</p>}
      {item.suggested_stage ? <button type="button" disabled={saving} onClick={() => onStage(item, item.suggested_stage!)} className="mt-3 w-full rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmer : {stages.find((stage) => stage.id === item.suggested_stage)?.label || item.suggested_stage}</button> : null}
    </div>
    <footer className={`${wide ? "lg:col-span-3" : ""} mt-4 border-t border-slate-100 pt-3 dark:border-slate-800`}><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-500">Étape<select value={current} disabled={saving} onChange={(event) => onStage(item, event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Mode<select value={item.pipeline_mode || "assisted"} disabled={saving} onChange={(event) => void onPatch(item, { target: "mode", pipelineMode: event.target.value })} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="assisted">Assisté</option><option value="automatic">Automatique</option><option value="manual">Manuel</option></select></label></div><div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-teal-700"><Link href={`/tableau-de-bord/dossiers/${item.id}`} className="inline-flex items-center gap-1">Ouvrir le dossier <ArrowRight className="h-3.5 w-3.5" /></Link><Link href={`/tableau-de-bord/dossiers/${item.id}?add=document#ajouter-source`} className="inline-flex items-center gap-1"><FilePlus2 className="h-3.5 w-3.5" />Document</Link><Link href="/tableau-de-bord#coach" className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />Coach</Link></div>{saving ? <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Évaluation du dossier…</p> : null}</footer>
  </article>;
}

function ViewButton({ active, icon, onClick, children }: { active: boolean; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${active ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>{icon}{children}</button>; }
function FamilyButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{children}</button>; }
function Summary({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "critical" }) { return <div className={`rounded-2xl border p-4 ${tone === "critical" ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}><p className="text-xs font-bold uppercase tracking-wide opacity-60">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>; }
function Progress({ label, value }: { label: string; value: number }) { return <div className="flex-1"><div className="flex justify-between text-[11px] text-slate-500"><span>{label}</span><span>{value}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>; }
function Empty({ family }: { family: Family }) { return <section className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700"><h2 className="font-semibold">Aucun dossier {family === "seller" ? "vendeur" : family === "buyer" ? "acheteur" : "après-vente"} actif</h2><p className="mt-2 text-sm text-slate-500">Les dossiers créés ou enrichis dans le CRM central apparaîtront ici automatiquement.</p><Link href="/tableau-de-bord/importer" className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Importer une source</Link></section>; }
function pipelineFamily(item: PipelineCase): Family { const type = item.pipeline_type || item.case_type; return type === "seller" ? "seller" : type === "post_transaction" ? "post_transaction" : "buyer"; }
function caseType(value: CrmPipelineType) { return value === "seller" ? "Vendeur" : value === "buy_sell" ? "Acheteur + vendeur" : value === "post_transaction" ? "Après-vente" : "Acheteur"; }
function priorityLabel(value?: string) { return value === "critical" ? "Critique" : value === "today" ? "Aujourd’hui" : value === "this_week" ? "Cette semaine" : value === "long_term" ? "Long terme" : "À surveiller"; }

