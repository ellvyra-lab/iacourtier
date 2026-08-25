"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Home, KeyRound, Loader2, Search, UserRound } from "lucide-react";
import { SessionStatusNotice, useDashboardAuth } from "@/components/auth/DashboardAuthProvider";

type ClientCase = {
  id: string;
  case_type: "seller" | "buyer" | "buy_sell" | "prospect" | "renewal" | "post_transaction" | "other";
  title: string;
  status: string;
  pipeline_stage: string;
  progress: number;
  current_stage?: string;
  pipeline_progress?: number;
  completion_score?: number;
  health_score?: number;
  priority_score?: number;
  next_action?: string;
  next_action_reason?: string;
  updated_at?: string;
  property?: { address?: string; city?: string; property_type?: string } | Array<{ address?: string; city?: string; property_type?: string }>;
};
type Client = { id: string; name: string; email?: string; phone?: string; mailing_address?: string; roles: string[]; tags?: string[]; client_status?: string; cases: ClientCase[] };
type Filter = "all" | "prospect" | "buyer" | "seller" | "buy_sell" | "transaction" | "after-sale" | "former";

const filters: Array<[Filter,string]> = [["all","Tous"],["prospect","Prospects"],["buyer","Acheteurs"],["seller","Vendeurs"],["buy_sell","Acheteurs + vendeurs"],["transaction","Transactions"],["after-sale","Après-vente"],["former","Anciens clients"]];

export function ClientsCasesDashboard() {
  const { status: authStatus, authenticatedFetch } = useDashboardAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const load = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/clients${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`, { cache: "no-store" });
      const payload = await response.json() as { clients?: Client[]; error?: string; warning?: string };
      if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
      setClients(payload.clients || []);
      setWarning(payload.warning || "");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible."); }
    finally { setLoading(false); }
  }, [authStatus, authenticatedFetch, query]);

  useEffect(() => { const timeout = window.setTimeout(load, 220); return () => window.clearTimeout(timeout); }, [load]);

  const visible = useMemo(() => clients.filter((client) => {
    if (filter === "all") return true;
    if (filter === "seller" || filter === "buyer") return client.roles.includes(filter) || client.cases.some((item) => item.case_type === filter || item.case_type === "buy_sell");
    if (filter === "buy_sell") return client.cases.some((item) => item.case_type === "buy_sell") || (client.roles.includes("buyer") && client.roles.includes("seller"));
    if (filter === "prospect") return client.client_status === "prospect" || client.cases.length === 0 || client.cases.some((item) => item.case_type === "prospect");
    if (filter === "after-sale") return client.cases.some((item) => item.case_type === "post_transaction" || /post_transaction|completed|transaction_completed/i.test(item.pipeline_stage));
    if (filter === "former") return client.client_status === "former" || client.roles.some((role) => /ancien|former/i.test(role));
    return client.cases.some((item) => item.status === "active" && !/post_transaction|completed|transaction_completed/i.test(item.pipeline_stage));
  }), [clients, filter]);

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-teal-700">CRM unifié</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Clients & dossiers</h1><p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">Une personne, une fiche client, plusieurs dossiers dans le temps.</p></div><div className="flex flex-wrap gap-2"><Link href="/tableau-de-bord/clients/importer" className="inline-flex items-center gap-2 rounded-xl border border-teal-700 px-4 py-3 text-sm font-semibold text-teal-700"><FileSpreadsheet className="h-4 w-4" />Importer ma liste</Link><Link href="/tableau-de-bord/inscriptions/nouvelle" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Nouveau vendeur</Link><Link href="/tableau-de-bord/acheteurs/nouveau" className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Nouvel acheteur</Link></div></header>
    <SessionStatusNotice />
    <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, téléphone, courriel, adresse, propriété ou dossier" className="min-h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" /></div>
    <nav className="flex flex-wrap gap-2">{filters.map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${filter === key ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>{label}</button>)}</nav>
    {warning ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{warning}</div> : null}{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-700" /></div> : visible.length ? <div className="grid gap-4 xl:grid-cols-2">{visible.map((client) => <ClientCard key={client.id} client={client} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">Aucun client ne correspond à cette vue.</div>}
  </div>;
}

function ClientCard({ client }: { client: Client }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950"><UserRound className="h-5 w-5" /></span><div><Link href={`/tableau-de-bord/clients/${client.id}`} className="group inline-flex items-center gap-2 text-lg font-semibold hover:text-teal-700">{client.name}<ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></Link><p className="mt-1 text-sm text-slate-500">{client.email || client.phone || "Coordonnées à compléter"}</p><div className="mt-2 flex flex-wrap gap-1">{client.roles.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize dark:bg-slate-800">{role === "seller" ? "Vendeur" : role === "buyer" ? "Acheteur" : role === "buy_sell" ? "Acheteur + vendeur" : role}</span>)}{(client.tags || []).slice(0, 5).map((tag) => <span key={tag} className="rounded-full bg-teal-50 px-2 py-1 text-xs text-teal-800 dark:bg-teal-950 dark:text-teal-100">{tag}</span>)}</div></div></div></div>
    <div className="mt-5 space-y-2 border-l-2 border-slate-200 pl-4 dark:border-slate-700">{client.cases.length ? client.cases.map((item) => <CaseRow key={item.id} item={item} />) : <p className="text-sm text-slate-500">Prospect · Aucun dossier actif</p>}</div></article>;
}

function CaseRow({ item }: { item: ClientCase }) {
  const property = Array.isArray(item.property) ? item.property[0] : item.property;
  const seller = item.case_type === "seller";
  const label = item.title || (seller ? property?.address || "Dossier vendeur" : "Dossier acheteur");
  const href = `/tableau-de-bord/dossiers/${item.id}`;
  const Icon = seller ? Home : KeyRound;
  return <Link href={href} className="flex items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-950"><span className="flex items-center gap-3"><Icon className="h-4 w-4 text-teal-700" /><span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-slate-500">{caseTypeLabel(item.case_type)} · {formatStatus(item.current_stage || item.pipeline_stage)} · pipeline {item.pipeline_progress ?? item.progress} % · santé {item.health_score ?? 100} %</span>{item.next_action ? <span className="mt-1 block text-xs font-medium text-teal-700">Prochaine action : {item.next_action}</span> : null}</span></span><ArrowRight className="h-4 w-4 text-slate-400" /></Link>;
}
function formatStatus(value: string) { return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function caseTypeLabel(value: ClientCase["case_type"]) { return ({ seller: "Vendeur", buyer: "Acheteur", buy_sell: "Acheteur + vendeur", prospect: "Prospect", renewal: "Renouvellement", post_transaction: "Après-vente", other: "Autre" })[value]; }

