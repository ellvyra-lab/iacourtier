"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Clock3,
  FileText,
  ListTodo,
  Loader2,
  Megaphone,
  Plus,
  Radar,
  Search,
  Sparkles,
  Upload,
  UsersRound,
  Workflow,
} from "lucide-react";

import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { UniversalSearch } from "@/components/dashboard/UniversalSearch";

type ClientCase = {
  id: string;
  title: string;
  case_type: string;
  current_stage?: string;
  pipeline_stage?: string;
  status?: string;
  next_action?: string;
  next_action_reason?: string;
  priority_score?: number;
  alerts?: CrmAlert[];
};

type RecentClient = { id: string; name: string; cases: ClientCase[] };
type CrmAlert = { code?: string; level?: string; title: string; detail?: string; dueAt?: string | null };
type ActivityEvent = {
  id: string;
  case_id?: string | null;
  client_id?: string | null;
  event_type: string;
  title: string;
  details?: string | null;
  created_at: string;
};
type DayData = {
  tasks: Array<{ id: string; case_id?: string | null; title: string; due_at?: string | null; due_on?: string | null; due_context?: string | null; action_type?: string; priority_score?: number }>;
  appointments: Array<{ id: string; case_id?: string | null; title: string; starts_at: string }>;
  nextActions: Array<{ id: string; title: string; next_action: string; next_action_reason?: string; priority_score: number }>;
  activities: ActivityEvent[];
  counts: { followUps: number; calls: number; appointments: number; documents: number; overdue: number };
};
type PipelinePayload = { cases?: ClientCase[]; error?: string };
type ToolLink = { icon: ElementType; label: string; description: string; href: string; accent: string };

const emptyDay: DayData = {
  tasks: [],
  appointments: [],
  nextActions: [],
  activities: [],
  counts: { followUps: 0, calls: 0, appointments: 0, documents: 0, overdue: 0 },
};

const tools: ToolLink[] = [
  { icon: BarChart3, label: "Pipeline", description: "Voir les transactions et leur progression", href: "/tableau-de-bord/pipeline", accent: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" },
  { icon: UsersRound, label: "Clients", description: "Accéder à ton CRM central", href: "/tableau-de-bord/clients", accent: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  { icon: BriefcaseBusiness, label: "Transactions", description: "Voir les dossiers actifs", href: "/tableau-de-bord/clients?vue=transaction", accent: "text-cyan-700 bg-cyan-50 dark:bg-cyan-950/30" },
  { icon: Building2, label: "Propriétés", description: "Retrouver toutes les propriétés", href: "/tableau-de-bord/mandats", accent: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" },
  { icon: Radar, label: "Radar prospection", description: "Trouver de nouvelles occasions", href: "/tableau-de-bord/radar-prospection", accent: "text-red-600 bg-red-50 dark:bg-red-950/30" },
  { icon: Search, label: "Évaluation IA", description: "Préparer une analyse de marché", href: "/tableau-de-bord/actions/prepare-market-analysis", accent: "text-violet-600 bg-violet-50 dark:bg-violet-950/30" },
  { icon: ClipboardCheck, label: "Préparer Centris", description: "Continuer un dossier vendeur", href: "/tableau-de-bord/clients?vue=seller", accent: "text-amber-700 bg-amber-50 dark:bg-amber-950/30" },
  { icon: Megaphone, label: "Marketing IA", description: "Créer le marketing d’une propriété", href: "/tableau-de-bord/actions/generate-marketing-launch", accent: "text-pink-600 bg-pink-50 dark:bg-pink-950/30" },
  { icon: FileText, label: "Documents", description: "Importer et retrouver les documents", href: "/tableau-de-bord/telechargements", accent: "text-slate-700 bg-slate-100 dark:bg-slate-800" },
  { icon: CalendarCheck, label: "Rapports clients", description: "Retrouver les rapports et l’historique", href: "/tableau-de-bord/historique", accent: "text-teal-700 bg-teal-50 dark:bg-teal-950/30" },
  { icon: Workflow, label: "Automatisations", description: "Voir les suivis automatiques", href: "/tableau-de-bord/automatisations", accent: "text-orange-700 bg-orange-50 dark:bg-orange-950/30" },
];

const quickActions = [
  { icon: UsersRound, label: "Nouveau client", href: "#dire-a-iacourtier" },
  { icon: BriefcaseBusiness, label: "Nouvelle transaction", href: "#dire-a-iacourtier" },
  { icon: Upload, label: "Importer un document", href: "/tableau-de-bord/importer" },
  { icon: ListTodo, label: "Nouvelle tâche", href: "/tableau-de-bord/actions" },
  { icon: Search, label: "Évaluation", href: "/tableau-de-bord/actions/prepare-market-analysis" },
  { icon: ClipboardCheck, label: "Préparer Centris", href: "/tableau-de-bord/clients?vue=seller" },
  { icon: Megaphone, label: "Créer le marketing", href: "/tableau-de-bord/actions/generate-marketing-launch" },
];

const pipelineBuckets = [
  { label: "Nouveaux leads", stages: ["new_seller_lead", "new_buyer_lead", "contact_established"] },
  { label: "Qualification", stages: ["qualification", "prequalification", "buyer_brokerage_contract", "criteria_to_complete", "evaluation_appointment", "evaluation_completed"] },
  { label: "Mandats à obtenir", stages: ["mandate_to_obtain"] },
  { label: "Mandats signés", stages: ["mandate_signed", "documents_to_complete", "listing_preparation", "ready_to_publish"] },
  { label: "En marché", stages: ["on_market", "active_search", "visits", "visits_followups"] },
  { label: "Offres", stages: ["offer_received", "offer_preparation", "offer_submitted", "offer_accepted"] },
  { label: "Conditions", stages: ["conditions_in_progress", "conditions_satisfied"] },
  { label: "Notaire", stages: ["notary", "sold", "purchase_completed"] },
];

export function GuidedHomeDashboard() {
  const { status: authStatus, user, authenticatedFetch } = useDashboardAuth();
  const [clients, setClients] = useState<RecentClient[]>([]);
  const [day, setDay] = useState<DayData>(emptyDay);
  const [pipelineCases, setPipelineCases] = useState<ClientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const firstName = String(user?.user_metadata?.full_name || user?.email?.split("@")[0] || "").split(/\s+/)[0] || "Courtier";

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    async function loadCommandCenter() {
      setLoading(true);
      try {
        const [clientsResponse, dayResponse, pipelineResponse] = await Promise.all([
          authenticatedFetch("/api/clients", { cache: "no-store" }),
          authenticatedFetch("/api/crm/day", { cache: "no-store" }),
          authenticatedFetch("/api/crm/pipeline", { cache: "no-store" }),
        ]);
        const [clientsPayload, dayPayload, pipelinePayload] = await Promise.all([
          clientsResponse.json() as Promise<{ clients?: RecentClient[]; error?: string }>,
          dayResponse.json() as Promise<DayData & { error?: string }>,
          pipelineResponse.json() as Promise<PipelinePayload>,
        ]);
        if (!clientsResponse.ok) throw new Error(clientsPayload.error || "Impossible de charger les clients.");
        if (!dayResponse.ok) throw new Error(dayPayload.error || "Impossible de charger ta journée.");
        if (!pipelineResponse.ok) throw new Error(pipelinePayload.error || "Impossible de charger le pipeline.");
        if (!cancelled) {
          setClients(clientsPayload.clients || []);
          setDay({ ...emptyDay, ...dayPayload, activities: dayPayload.activities || [] });
          setPipelineCases(pipelinePayload.cases || []);
          setLoadError("");
        }
      } catch (reason) {
        if (!cancelled) setLoadError(reason instanceof Error ? reason.message : "Impossible de charger le centre de commande.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCommandCenter();
    return () => { cancelled = true; };
  }, [authStatus, authenticatedFetch]);

  const priorities = useMemo(() => {
    const taskRows = day.tasks.slice(0, 4).map((item) => ({
      id: "task-" + item.id,
      title: item.title,
      detail: item.due_context || dueLabel(item.due_at, item.due_on),
      href: item.case_id ? "/tableau-de-bord/dossiers/" + item.case_id : "/tableau-de-bord/actions",
      urgent: isOverdue(item.due_at, item.due_on),
    }));
    const appointmentRows = day.appointments.slice(0, 2).map((item) => ({
      id: "appointment-" + item.id,
      title: item.title,
      detail: formatDateTime(item.starts_at),
      href: item.case_id ? "/tableau-de-bord/dossiers/" + item.case_id : "/tableau-de-bord/actions",
      urgent: false,
    }));
    const nextActionRows = day.nextActions.slice(0, 3).map((item) => ({
      id: "case-" + item.id,
      title: item.next_action,
      detail: item.title + (item.next_action_reason ? " · " + item.next_action_reason : ""),
      href: "/tableau-de-bord/dossiers/" + item.id,
      urgent: item.priority_score >= 80,
    }));
    return [...taskRows, ...appointmentRows, ...nextActionRows].slice(0, 6);
  }, [day]);

  const alerts = useMemo(() => pipelineCases.flatMap((item) => (item.alerts || []).map((alert, index) => ({
    id: item.id + "-" + (alert.code || index),
    caseId: item.id,
    caseTitle: item.title,
    alert,
  }))).slice(0, 6), [pipelineCases]);

  const pipelineCounts = useMemo(() => pipelineBuckets.map((bucket) => ({
    ...bucket,
    count: pipelineCases.filter((item) => bucket.stages.includes(item.current_stage || item.pipeline_stage || "")).length,
  })), [pipelineCases]);

  const continueItem = useMemo(() => {
    const activity = day.activities.find((item) => item.case_id);
    if (activity?.case_id) return { title: activity.title, detail: "Dernière activité · " + formatDateTime(activity.created_at), href: "/tableau-de-bord/dossiers/" + activity.case_id };
    const item = pipelineCases[0];
    return item ? { title: item.title, detail: item.next_action || "Continuer le dossier", href: "/tableau-de-bord/dossiers/" + item.id } : null;
  }, [day.activities, pipelineCases]);


  return <div className="mx-auto max-w-[1500px] space-y-8 pb-24">
    <header className="grid gap-5 xl:grid-cols-[1fr_minmax(360px,620px)] xl:items-end">
      <div>
        <p className="text-sm font-bold text-teal-700">Bonjour {firstName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Voici ce qui mérite ton attention aujourd’hui</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Tes priorités et tes outils, au même endroit, à partir des vraies données de ton CRM.</p>
      </div>
      <UniversalSearch mobile />
    </header>

    {loadError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div> : null}

    <section aria-labelledby="today-title">
      <SectionHeading eyebrow="Aujourd’hui" title="Ce que tu dois faire maintenant" href="/tableau-de-bord/actions" linkLabel="Voir toutes les tâches" />
      {loading ? <LoadingPanel /> : priorities.length ? <div className="grid gap-3 lg:grid-cols-2">{priorities.map((item) => <Link key={item.id} href={item.href} className="group flex min-h-24 items-start gap-4 rounded-2xl border border-subtle bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"><span className={"mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + (item.urgent ? "bg-red-100 text-red-700 dark:bg-red-950/40" : "bg-teal-50 text-teal-700 dark:bg-teal-950/30")}>{item.urgent ? <AlertTriangle className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-sm text-muted">{item.detail || "Ouvrir pour continuer"}</span></span><ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-teal-700" /></Link>)}</div> : <EmptyState title="Aucune urgence pour le moment" detail="Les prochaines tâches, échéances et actions de dossiers apparaîtront ici." />}
    </section>

    <section aria-labelledby="tools-title">
      <SectionHeading eyebrow="Accès direct" title="Outils IACourtier" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{tools.map((item) => <ToolCard key={item.label} {...item} />)}</div>
    </section>

    <section className="rounded-3xl border border-subtle bg-surface-soft p-5 sm:p-6">
      <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-teal-700" /><h2 className="text-xl font-semibold">Accès rapide</h2></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap">{quickActions.map((item) => <Link key={item.label} href={item.href} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-subtle bg-surface px-4 text-sm font-semibold shadow-sm hover:border-teal-300 hover:text-teal-700"><item.icon className="h-4 w-4" />{item.label}</Link>)}</div>
    </section>


    <section aria-labelledby="pipeline-title">
      <SectionHeading eyebrow="Vue d’ensemble" title="Mon pipeline" href="/tableau-de-bord/pipeline" linkLabel="Ouvrir le pipeline" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{pipelineCounts.map((bucket) => <Link key={bucket.label} href="/tableau-de-bord/pipeline" className="rounded-2xl border border-subtle bg-surface p-4 shadow-sm transition hover:border-indigo-300"><span className="text-3xl font-semibold">{bucket.count}</span><span className="mt-2 block text-xs font-semibold text-muted">{bucket.label}</span></Link>)}</div>
      {!loading && !pipelineCases.length ? <p className="mt-3 text-sm text-muted">Aucun dossier actif. Les compteurs resteront à zéro jusqu’à la création d’un vrai dossier.</p> : null}
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="alerts-title">
        <SectionHeading eyebrow="À surveiller" title="Alertes intelligentes" href="/tableau-de-bord/pipeline" linkLabel="Voir le pipeline" />
        {alerts.length ? <div className="space-y-3">{alerts.map((item) => <Link key={item.id} href={"/tableau-de-bord/dossiers/" + item.caseId} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 transition hover:border-amber-400 dark:border-amber-950 dark:bg-amber-950/20"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><span className="min-w-0"><span className="block font-semibold">{item.alert.title}</span><span className="mt-1 block text-sm text-muted">{item.caseTitle}{item.alert.detail ? " · " + item.alert.detail : ""}</span></span></Link>)}</div> : <EmptyState title="Aucune alerte active" detail="Les alertes calculées à partir des dossiers apparaîtront ici." />}
      </section>

      <section aria-labelledby="recent-title">
        <SectionHeading eyebrow="CRM" title="Activité récente" />
        {day.activities.length ? <div className="space-y-3">{day.activities.slice(0, 6).map((item) => {
          const content = <><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800"><Activity className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-xs text-muted">{formatDateTime(item.created_at)}</span></span>{item.case_id ? <ArrowRight className="h-4 w-4 text-muted" /> : null}</>;
          return item.case_id ? <Link key={item.id} href={"/tableau-de-bord/dossiers/" + item.case_id} className="flex items-center gap-3 rounded-2xl border border-subtle bg-surface p-4 hover:border-teal-300">{content}</Link> : <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-subtle bg-surface p-4">{content}</div>;
        })}</div> : <EmptyState title="Aucune activité récente" detail="Les modifications et ajouts réels du CRM apparaîtront ici." />}
      </section>
    </div>

    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-3xl border border-subtle bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Continuer où j’étais</p>
        {continueItem ? <><h2 className="mt-4 text-2xl font-semibold">{continueItem.title}</h2><p className="mt-2 text-sm text-slate-300">{continueItem.detail}</p><Link href={continueItem.href} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-semibold text-slate-950">Continuer <ArrowRight className="h-4 w-4" /></Link></> : <><h2 className="mt-4 text-2xl font-semibold">Tout est prêt pour commencer</h2><p className="mt-2 text-sm text-slate-300">Ton dernier dossier consulté apparaîtra ici.</p></>}
      </div>

      <div id="coach" className="scroll-mt-24 rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 dark:border-teal-900 dark:from-teal-950/30 dark:to-slate-900">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-teal-700">IACourtier</p><h2 className="mt-1 text-xl font-semibold">Parle-moi de ce que tu veux accomplir</h2></div><Bot className="h-8 w-8 text-teal-700" /></div>
        <p className="mt-3 text-sm text-muted">{priorities.length ? "Tu as " + priorities.length + " priorité" + (priorities.length > 1 ? "s" : "") + " visible" + (priorities.length > 1 ? "s" : "") + " aujourd’hui." : "Je suis prêt à t’aider à organiser ta prochaine action."}</p>
        <p className="mt-4 text-sm text-muted">Utilise le bouton IACourtier dans la barre supérieure pour écrire ou dicter une demande. Ta conversation et les actions en attente restent dans le même assistant.</p>
      </div>
    </section>
  </div>;
}

function ToolCard({ icon: Icon, label, description, href, accent }: ToolLink) {
  return <Link href={href} className="group flex min-h-36 flex-col rounded-2xl border border-subtle bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"><span className={"flex h-11 w-11 items-center justify-center rounded-xl " + accent}><Icon className="h-5 w-5" /></span><span className="mt-4 font-semibold">{label}</span><span className="mt-1 text-xs leading-5 text-muted">{description}</span><ArrowRight className="ml-auto mt-auto h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-teal-700" /></Link>;
}

function SectionHeading({ eyebrow, title, href, linkLabel }: { eyebrow: string; title: string; href?: string; linkLabel?: string }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2></div>{href && linkLabel ? <Link href={href} className="hidden items-center gap-2 text-sm font-semibold text-teal-700 sm:inline-flex">{linkLabel}<ArrowRight className="h-4 w-4" /></Link> : null}</div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed border-subtle bg-surface-soft p-6"><p className="font-semibold">{title}</p><p className="mt-2 text-sm text-muted">{detail}</p></div>;
}

function LoadingPanel() {
  return <div className="flex min-h-28 items-center justify-center rounded-2xl border border-subtle bg-surface"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>;
}


function formatDateTime(value: string) {
  try { return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return value; }
}

function dueLabel(dueAt?: string | null, dueOn?: string | null) {
  if (dueAt) return formatDateTime(dueAt);
  if (dueOn) return "Échéance · " + dueOn;
  return "À faire";
}

function isOverdue(dueAt?: string | null, dueOn?: string | null) {
  const now = new Date();
  if (dueAt) return new Date(dueAt).getTime() < now.getTime();
  if (dueOn) return dueOn < now.toISOString().slice(0, 10);
  return false;
}
