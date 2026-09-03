"use client";

import { useEffect, useMemo, useState, type ElementType, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, FileSpreadsheet, FileUp, Home, KeyRound, Loader2, Megaphone, Phone, Search, Send, Sparkles } from "lucide-react";

import { buildSoniaBattlePlan, getSoniaProspects, type SoniaProspect } from "@/lib/sonia-beta";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { UniversalQuickCapture } from "@/components/universal-quick-capture";

type ClientCase = { id: string; case_type: "seller" | "buyer" | "buy_sell" | "prospect" | "renewal" | "post_transaction" | "other"; title: string; status: string; pipeline_stage: string; progress: number; next_action?: string; property?: { address?: string } | Array<{ address?: string }> };
type RecentClient = { id: string; name: string; cases: ClientCase[] };
type CoachAnswer = { reply: string; action: { label: string; href: string } };
type DayData = { tasks: Array<{ id: string; case_id: string; title: string; due_at?: string; action_type?: string; priority_score?: number }>; appointments: Array<{ id: string; case_id?: string; title: string; starts_at: string }>; nextActions: Array<{ id: string; title: string; next_action: string; next_action_reason?: string; priority_score: number }>; counts: { followUps: number; calls: number; appointments: number; documents: number; overdue: number } };

const actions: Array<{ icon: ElementType; label: string; href: string; primary?: boolean }> = [
  { icon: FileUp, label: "Importer un document ou une conversation", href: "/tableau-de-bord/importer", primary: true },
  { icon: Home, label: "J’ai un nouveau vendeur", href: "/tableau-de-bord/inscriptions/nouvelle", primary: true },
  { icon: KeyRound, label: "J’ai un nouvel acheteur", href: "/tableau-de-bord/acheteurs/nouveau", primary: true },
  { icon: FileSpreadsheet, label: "J’ai une liste de clients à importer", href: "/tableau-de-bord/clients/importer", primary: true },
  { icon: Phone, label: "Je veux prospecter", href: "/tableau-de-bord/radar-prospection" },
  { icon: CheckCircle2, label: "Je veux faire mes suivis", href: "/tableau-de-bord/prospects" },
  { icon: CalendarCheck, label: "Je veux préparer un rendez-vous", href: "/tableau-de-bord/actions/prepare-market-analysis" },
  { icon: Sparkles, label: "Demander au Coach IA", href: "#coach" },
];

export function GuidedHomeDashboard() {
  const { status: authStatus, user, authenticatedFetch } = useDashboardAuth();
  const [prospects, setProspects] = useState<SoniaProspect[]>([]);
  const [clients, setClients] = useState<RecentClient[]>([]);
  const [day, setDay] = useState<DayData>({ tasks: [], appointments: [], nextActions: [], counts: { followUps: 0, calls: 0, appointments: 0, documents: 0, overdue: 0 } });
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<CoachAnswer | null>(null);
  const [sending, setSending] = useState(false);
  const firstName = String(
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || user?.id.slice(0, 8) || "",
  ).split(/\s+/)[0];

  useEffect(() => {
    setProspects(getSoniaProspects().filter((item) => !item.id.startsWith("sonia-demo-")));
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    authenticatedFetch("/api/clients", { cache: "no-store" }).then((response) => response.json()).then((payload: { clients?: RecentClient[] }) => setClients(payload.clients || [])).catch(() => undefined);
    authenticatedFetch("/api/crm/day", { cache: "no-store" }).then((response) => response.json()).then((payload: Partial<DayData>) => setDay({ tasks: payload.tasks || [], appointments: payload.appointments || [], nextActions: payload.nextActions || [], counts: payload.counts || { followUps: 0, calls: 0, appointments: 0, documents: 0, overdue: 0 } })).catch(() => undefined);
  }, [authStatus, authenticatedFetch, user]);

  const plan = useMemo(() => buildSoniaBattlePlan(prospects), [prospects]);
  const recentCases = useMemo(() => clients.flatMap((client) => client.cases.map((item) => ({ ...item, clientName: client.name }))).slice(0, 3), [clients]);
  const priorities = useMemo(() => {
    const operations = [
      ...day.tasks.map((task) => ({ title: task.title, detail: task.due_at ? `Tâche · ${formatDayDate(task.due_at)}` : "Tâche à planifier", href: `/tableau-de-bord/dossiers/${task.case_id}` })),
      ...day.appointments.map((appointment) => ({ title: appointment.title, detail: `Rendez-vous · ${formatDayDate(appointment.starts_at)}`, href: appointment.case_id ? `/tableau-de-bord/dossiers/${appointment.case_id}` : "/tableau-de-bord/clients" })),
    ];
    const central = day.nextActions.map((item) => ({ title: item.next_action, detail: `${item.title} · ${item.next_action_reason || `priorité ${item.priority_score}/100`}`, href: `/tableau-de-bord/dossiers/${item.id}` }));
    const crm = central.length ? central : clients.flatMap((client) => client.cases.filter((item) => item.status === "active" && item.next_action).map((item) => ({ title: item.next_action || "Continuer le dossier", detail: `${client.name} · ${item.title}`, href: `/tableau-de-bord/dossiers/${item.id}` })));
    return operations.length ? [...operations, ...crm] : crm.length ? crm : buildPriorities(prospects, plan);
  }, [clients, day, prospects, plan]);
  const nextBest = priorities[0] || { title: "Trouver ton prochain prospect", href: "/tableau-de-bord/radar-prospection" };

  async function askCoach(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    const intent = inferHomeIntent(prompt);
    if (intent) { setAnswer(intent); setPrompt(""); return; }
    setSending(true);
    try {
      const context = {
        userName: firstName, informationRequests: 0, sellerAppointmentsToPrepare: plan.sellerAppointmentsToPrepare.length,
        followupsDue: plan.followupsDue.length, marketAnalysesToPrepare: plan.marketAnalysesToPrepare.length,
        radarProspectsToCall: plan.radarProspectsToCall.length, callsToMake: plan.callsToMake.length,
        mandatesWithMissingDocuments: plan.mandatesWithMissingDocuments.length, marketingActionsToGenerate: plan.marketingActionsToGenerate.length,
        totalProspects: prospects.length, prospectsCreatedToday: 0, callsCompletedToday: 0, overdueFollowups: plan.followupsDue.length,
        appointmentsToday: 0, appointmentsTomorrow: 0, pendingMarketAnalyses: plan.marketAnalysesToPrepare.length, newContacts: 0,
        buyerPipeline: prospects.filter((item) => item.clientType === "buyer").length, sellerPipeline: prospects.filter((item) => item.clientType === "seller").length,
      };
      const response = await authenticatedFetch("/api/coach/director", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: prompt, context }) });
      const payload = await response.json() as CoachAnswer & { error?: string };
      setAnswer(response.ok ? payload : { reply: payload.error || "Le Coach est temporairement indisponible.", action: { label: "Voir ma journée", href: "/tableau-de-bord" } });
      setPrompt("");
    } catch { setAnswer({ reply: "Le Coach est temporairement indisponible.", action: { label: "Voir ma journée", href: "/tableau-de-bord" } }); }
    finally { setSending(false); }
  }

  return <div className="mx-auto max-w-7xl space-y-8">
    <header><p className="text-sm font-semibold text-teal-700">Bonjour {firstName},</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Qu’est-ce que tu veux faire aujourd’hui?</h1></header>
    <UniversalQuickCapture />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">{actions.map((action) => <ActionCard key={action.label} {...action} />)}</section>

    <section id="coach" className="scroll-mt-24 overflow-hidden rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm dark:border-teal-900 dark:from-teal-950/30 dark:to-slate-900 sm:p-7"><div className="flex items-center gap-2 text-sm font-semibold text-teal-800 dark:text-teal-200"><Sparkles className="h-5 w-5" />Coach IA</div><h2 className="mt-2 text-xl font-semibold">Ou écris simplement ce que tu veux faire…</h2><form onSubmit={askCoach} className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Marie veut acheter une maison à Repentigny…" className="min-h-13 flex-1 rounded-2xl border border-teal-200 bg-white px-4 dark:border-teal-900 dark:bg-slate-950" /><button type="submit" disabled={sending || !prompt.trim()} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 font-semibold text-white disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Comprendre et continuer</button></form><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>« J’ai pris une nouvelle inscription au 300 rue Bob. »</span><span>« Je veux faire mes appels de prospection. »</span><span>« Qu’est-ce que je devrais faire aujourd’hui? »</span></div>{answer ? <div className="mt-5 rounded-2xl border border-teal-200 bg-white p-4 dark:border-teal-900 dark:bg-slate-950"><p className="text-sm leading-6">{answer.reply}</p><Link href={answer.action.href} className="mt-3 inline-flex items-center gap-2 font-semibold text-teal-700">{answer.action.label}<ArrowRight className="h-4 w-4" /></Link></div> : null}</section>

    <section className="space-y-4"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Ma journée</p><h2 className="mt-1 text-2xl font-semibold">{priorities.length || 1} priorité{priorities.length > 1 ? "s" : ""} aujourd’hui</h2></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Suivis",day.counts.followUps],["Appels",day.counts.calls],["Rendez-vous",day.counts.appointments],["Documents",day.counts.documents],["En retard",day.counts.overdue]].map(([title,value]) => <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">{title}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">{priorities.length ? <div className="space-y-2">{priorities.slice(0, 3).map((item) => <Link key={`${item.title}-${item.href}`} href={item.href} className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-950"><span><span className="block text-sm font-semibold">{item.title}</span><span className="text-xs text-slate-500">{item.detail}</span></span><ArrowRight className="h-4 w-4 text-slate-400" /></Link>)}</div> : <p className="text-sm text-slate-500">Aucune urgence détectée. Commence par une nouvelle conversation.</p>}</div><div className="rounded-2xl bg-slate-950 p-5 text-white dark:bg-white dark:text-slate-950"><p className="text-sm font-semibold text-teal-300 dark:text-teal-700">Ma prochaine meilleure action</p><p className="mt-4 text-xl font-semibold">{nextBest.title}</p><Link href={nextBest.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Continuer<ArrowRight className="h-4 w-4" /></Link></div></div></section>

    <section><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Dossiers récents</p><h2 className="mt-1 text-2xl font-semibold">Reprendre là où tu étais</h2></div><Link href="/tableau-de-bord/clients" className="hidden text-sm font-semibold text-teal-700 sm:inline">Voir tous mes dossiers</Link></div>{recentCases.length ? <div className="mt-4 grid gap-4 lg:grid-cols-3">{recentCases.map((item) => <RecentCase key={item.id} item={item} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Tes dossiers réels apparaîtront ici automatiquement après leur création.</div>}<Link href="/tableau-de-bord/clients" className="mt-4 inline-flex text-sm font-semibold text-teal-700 sm:hidden">Voir tous mes dossiers</Link></section>
  </div>;
}

function ActionCard({ icon: Icon, label, href, primary }: { icon: ElementType; label: string; href: string; primary?: boolean }) { return <Link href={href} className={`group flex min-h-32 flex-col justify-between rounded-2xl border p-4 transition hover:-translate-y-1 hover:shadow-lg sm:min-h-40 sm:p-5 ${primary ? "border-teal-300 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}><Icon className="h-6 w-6 text-teal-700" /><span className="mt-5 text-sm font-semibold leading-5 sm:text-base">{label}</span></Link>; }
function RecentCase({ item }: { item: ClientCase & { clientName: string } }) { const property = Array.isArray(item.property) ? item.property[0] : item.property; const seller = item.case_type === "seller"; return <Link href={`/tableau-de-bord/dossiers/${item.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950">{seller ? <Home className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}</span><h3 className="mt-4 font-semibold">{item.title || property?.address || item.clientName}</h3><p className="mt-2 text-sm text-slate-500">{seller ? "Vendeur" : item.case_type === "buy_sell" ? "Acheteur + vendeur" : "Acheteur"} · {item.pipeline_stage.replace(/_/g, " ")} · {item.progress} %</p>{item.next_action ? <p className="mt-2 text-sm font-medium text-teal-700">{item.next_action}</p> : null}</Link>; }

function buildPriorities(prospects: SoniaProspect[], plan: ReturnType<typeof buildSoniaBattlePlan>) {
  const output: Array<{ title: string; detail: string; href: string }> = [];
  plan.followupsDue.slice(0, 2).forEach((item) => output.push({ title: `Rappeler ${item.name}`, detail: item.nextAction, href: `/tableau-de-bord/prospects/${item.id}` }));
  plan.sellerAppointmentsToPrepare.slice(0, 1).forEach((item) => output.push({ title: `Préparer le rendez-vous de ${item.name}`, detail: item.address, href: "/tableau-de-bord/actions/prepare-market-analysis" }));
  if (!output.length && prospects[0]) output.push({ title: prospects[0].nextAction, detail: prospects[0].name, href: `/tableau-de-bord/prospects/${prospects[0].id}` });
  return output;
}

function inferHomeIntent(message: string): CoachAnswer | null {
  const value = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/acheteur|acheter|pre.?approbation/.test(value)) return { reply: "J’ai reconnu un nouveau projet acheteur. Je vais identifier la personne, rechercher les doublons, relier sa fiche client et créer son dossier avant les étapes et automatisations.", action: { label: "Créer le dossier acheteur", href: "/tableau-de-bord/acheteurs/nouveau" } };
  if (/vendeur|inscription|mandat|propriete.*vendre/.test(value)) return { reply: "J’ai reconnu un nouveau projet vendeur. Commence avec les documents si tu les as : le client sera identifié et relié automatiquement avant la propriété et le mandat.", action: { label: "Créer le dossier vendeur", href: "/tableau-de-bord/inscriptions/nouvelle" } };
  if (/prospect|appel/.test(value)) return { reply: "Je t’amène à la prospection et aux appels prioritaires.", action: { label: "Prospecter", href: "/tableau-de-bord/radar-prospection" } };
  if (/suivi|relance/.test(value)) return { reply: "Je t’amène aux relations déjà engagées qui demandent un suivi.", action: { label: "Faire mes suivis", href: "/tableau-de-bord/prospects" } };
  if (/rendez.?vous|demain|preparer/.test(value)) return { reply: "Je t’amène à la préparation du prochain rendez-vous et de l’analyse de marché associée.", action: { label: "Préparer le rendez-vous", href: "/tableau-de-bord/actions/prepare-market-analysis" } };
  return null;
}
function formatDayDate(value: string) { return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

