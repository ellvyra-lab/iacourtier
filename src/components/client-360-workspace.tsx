"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, FileText, Home, Loader2, Mail, MapPin, Phone, Sparkles } from "lucide-react";

import { SessionStatusNotice, useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { ClientQuickPanel, type QuickClient } from "@/components/client-quick-panel";
import { PropertyQuickCard } from "@/components/property-quick-card";

type Payload = {
  client: QuickClient & Record<string, any>;
  cases: Array<Record<string, any>>;
  properties: Array<Record<string, any>>;
  documents: Array<Record<string, any>>;
  tasks: Array<Record<string, any>>;
  automations: Array<Record<string, any>>;
  communications: Array<Record<string, any>>;
  appointments: Array<Record<string, any>>;
  activity: Array<Record<string, any>>;
  contactMethods: Array<Record<string, any>>;
  addresses: Array<Record<string, any>>;
  corrections: Array<Record<string, any>>;
  crmEvents: Array<Record<string, any>>;
};

export function Client360Workspace({ clientId, returnHref, returnLabel }: { clientId: string; returnHref?: string; returnLabel?: string }) {
  const { status, authenticatedFetch } = useDashboardAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/clients/${clientId}`, { cache: "no-store" });
      const payload = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
      setData(payload);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible."); }
    finally { setLoading(false); }
  }, [authenticatedFetch, clientId, status]);

  useEffect(() => { void load(); }, [load]);

  const taskGroups = useMemo(() => groupTasks(data?.tasks || []), [data?.tasks]);
  if (loading || !data) return <div className="flex min-h-96 items-center justify-center">{error ? <p className="text-red-700">{error}</p> : <Loader2 className="h-8 w-8 animate-spin text-teal-700" />}</div>;
  const client = data.client;
  const name = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Client à identifier";

  return <div className="space-y-6">
    <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">{returnHref ? <Link href={returnHref} className="inline-flex items-center gap-2 font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" />Retour {returnLabel ? `à ${returnLabel}` : "au dossier"}</Link> : <><Link href="/tableau-de-bord/clients" className="hover:text-teal-700">Clients & dossiers</Link><span>›</span><span>{name}</span></>}</nav>
    <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl dark:bg-slate-900">
      <p className="text-sm font-semibold text-teal-300">Fiche client 360</p><h1 className="mt-2 text-3xl font-semibold">{name}</h1>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">{client.phone ? <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{client.phone}</span> : null}{client.email ? <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{client.email}</span> : null}{client.mailing_address ? <span className="inline-flex items-center gap-2"><Home className="h-4 w-4" />{[client.mailing_address, client.city, client.postal_code].filter(Boolean).join(", ")}</span> : null}</div>
      <div className="mt-4 flex flex-wrap gap-2">{[...(client.roles || []), ...(client.tags || [])].map((tag: string) => <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{label(tag)}</span>)}</div>
    </header>
    <SessionStatusNotice />

    <Section title="Identité et coordonnées" empty="Coordonnées à compléter."><ClientQuickPanel client={client} caseId={data.cases[0]?.id || null} caseLabel={data.cases[0]?.title} returnHref={returnHref || `/tableau-de-bord/clients/${clientId}`} returnLabel={returnLabel || "à la fiche client"} onUpdated={(updated) => setData((current) => current ? { ...current, client: updated } : current)} />{data.contactMethods.filter((item) => !item.is_primary).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">{item.method_type === "email" ? <Mail className="h-4 w-4 text-teal-700" /> : <Phone className="h-4 w-4 text-teal-700" />}<span><strong className="block">{item.value}</strong><span className="text-xs text-slate-500">{label(item.label)} · coordonnée secondaire</span></span></div>)}</Section>

    <section className="grid gap-4 lg:grid-cols-3">
      <Summary title="Dossiers" value={data.cases.length} detail="Tous les projets reliés" />
      <Summary title="Tâches ouvertes" value={data.tasks.filter((item) => item.status === "pending").length} detail={`${taskGroups.overdue.length} en retard`} />
      <Summary title="Documents" value={data.documents.length} detail={`${data.automations.length} automatisations préparées`} />
    </section>

    <Section title="Dossiers et pipelines" empty="Aucun dossier relié à cette personne.">
      {data.cases.map((item) => <Link key={item.id} href={`/tableau-de-bord/dossiers/${item.id}`} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 transition hover:border-teal-500 dark:border-slate-800"><span><strong className="block">{item.title}</strong><span className="mt-1 block text-sm text-slate-500">{caseType(item.case_type)} · {label(item.current_stage || item.pipeline_stage)} · pipeline {item.pipeline_progress ?? item.progress}% · complet {item.completion_score ?? 0}% · santé {item.health_score ?? 100}%</span>{item.next_action ? <span className="mt-2 block text-sm font-medium text-teal-700">Prochaine action : {item.next_action}</span> : null}{item.next_action_reason ? <span className="mt-1 block text-xs text-slate-500">{item.next_action_reason}</span> : null}</span><ArrowRight className="h-5 w-5 text-slate-400" /></Link>)}
    </Section>

    <div className="grid gap-6 xl:grid-cols-2">
      <Section title="Tâches" empty="Aucune tâche ouverte.">
        <TaskGroup title="En retard" items={taskGroups.overdue} tone="red" /><TaskGroup title="Aujourd’hui" items={taskGroups.today} tone="teal" /><TaskGroup title="À venir" items={taskGroups.upcoming} tone="slate" />
      </Section>
      <Section title="Propriétés" empty="Aucune propriété reliée.">{data.properties.map((item, index) => { const property = Array.isArray(item.property) ? item.property[0] : item.property; return property ? <PropertyQuickCard key={`${property.id || index}-${item.relationship}`} property={property} caseId={item.case_id || data.cases[0]?.id} returnHref={`/tableau-de-bord/clients/${clientId}`} returnLabel="à la fiche client" /> : null; })}</Section>
      <Section title="Adresses personnelles et postales" empty="Aucune adresse personnelle distincte.">{data.addresses.map((item) => <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><MapPin className="mt-0.5 h-5 w-5 text-teal-700" /><span><strong className="block text-sm">{item.address_line}</strong><span className="text-xs text-slate-500">{[item.city, item.postal_code].filter(Boolean).join(" · ")} · {label(item.address_type)}{item.is_primary ? " · principale" : ""}</span></span></div>)}</Section>
      <Section title="Documents" empty="Aucun document relié.">{data.documents.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><FileText className="h-5 w-5 text-teal-700" /><span><strong className="block text-sm">{item.name}</strong><span className="text-xs text-slate-500">{item.category} · {label(item.analysis_status)}</span></span></div>)}</Section>
      <Section title="Communications et rendez-vous" empty="Aucun échange enregistré.">{data.appointments.map((item) => <Timeline key={item.id} icon={<CalendarDays className="h-4 w-4" />} title={item.title} date={item.starts_at} />)}{data.communications.map((item) => <Timeline key={item.id} icon={<Mail className="h-4 w-4" />} title={item.subject || label(item.communication_type)} date={item.occurred_at} detail={item.body} />)}</Section>
      <Section title="Automatisations" empty="Aucune automatisation proposée.">{data.automations.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800"><span className="inline-flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-600" />{item.name}</span><span className="text-xs text-slate-500">{label(item.status)}</span></div>)}</Section>
      <Section title="Historique" empty="Aucun événement.">{[...data.activity.map((item) => ({ id: `activity-${item.id}`, title: item.title, date: item.created_at, detail: item.details })), ...data.corrections.map((item) => ({ id: `correction-${item.id}`, title: `Correction · ${label(item.field_key)}`, date: item.created_at, detail: `${item.previous_value || "vide"} → ${item.corrected_value}` })), ...data.crmEvents.map((item) => ({ id: `crm-${item.id}`, title: label(item.event_type), date: item.occurred_at, detail: "" }))].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 150).map((item) => <Timeline key={item.id} icon={<span className="h-2 w-2 rounded-full bg-teal-600" />} title={item.title} date={item.date} detail={item.detail} />)}</Section>
    </div>
  </div>;
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { const hasItems = Array.isArray(children) ? children.some(Boolean) : Boolean(children); return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-4 space-y-3">{hasItems ? children : <p className="text-sm text-slate-500">{empty}</p>}</div></section>; }
function Summary({ title, value, detail }: { title: string; value: number; detail: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; }
function TaskGroup({ title, items, tone }: { title: string; items: Array<Record<string, any>>; tone: "red" | "teal" | "slate" }) { if (!items.length) return null; const color = tone === "red" ? "text-red-700" : tone === "teal" ? "text-teal-700" : "text-slate-500"; return <div><h3 className={`mb-2 text-xs font-bold uppercase tracking-wide ${color}`}>{title}</h3>{items.map((item) => <div key={item.id} className="mb-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><strong>{item.title}</strong>{item.due_at ? <span className="mt-1 block text-xs text-slate-500">{formatDate(item.due_at)}</span> : null}</div>)}</div>; }
function Timeline({ icon, title, date, detail }: { icon: React.ReactNode; title: string; date: string; detail?: string }) { return <div className="flex gap-3"><span className="mt-1 text-teal-700">{icon}</span><span><strong className="block text-sm">{title}</strong><span className="text-xs text-slate-500">{formatDate(date)}</span>{detail ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{detail}</p> : null}</span></div>; }
function groupTasks(tasks: Array<Record<string, any>>) { const open = tasks.filter((item) => item.status === "pending"); const now = new Date(); const today = now.toISOString().slice(0, 10); return { overdue: open.filter((item) => item.due_at && item.due_at.slice(0, 10) < today), today: open.filter((item) => item.due_at?.slice(0, 10) === today), upcoming: open.filter((item) => !item.due_at || item.due_at.slice(0, 10) > today) }; }
function formatDate(value?: string) { if (!value) return "Date à confirmer"; return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(new Date(value)); }
function label(value?: string) { return (value || "").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function caseType(value: string) { return ({ buyer: "Acheteur", seller: "Vendeur", buy_sell: "Acheteur + vendeur", prospect: "Prospect", renewal: "Renouvellement", post_transaction: "Après-vente", other: "Autre" } as Record<string, string>)[value] || label(value); }
