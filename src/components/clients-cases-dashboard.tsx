"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Home, KeyRound, Loader2, Search, UserRound } from "lucide-react";
import { SessionStatusNotice, useDashboardAuth } from "@/components/auth/DashboardAuthProvider";

type ClientCase = {
  id: string;
  type: "seller" | "buyer";
  status: string;
  progress?: number;
  updated_at?: string;
  property?: { address?: string; city?: string; property_type?: string } | Array<{ address?: string; city?: string; property_type?: string }>;
};
type Client = { id: string; name: string; email?: string; phone?: string; mailing_address?: string; roles: string[]; cases: ClientCase[] };
type Filter = "all" | "seller" | "buyer" | "prospect" | "transaction" | "after-sale";

const filters: Array<[Filter,string]> = [["all","Tous"],["seller","Vendeurs"],["buyer","Acheteurs"],["prospect","Prospects"],["transaction","Transactions"],["after-sale","Après-vente"]];

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
    if (filter === "seller" || filter === "buyer") return client.roles.includes(filter) || client.cases.some((item) => item.type === filter);
    if (filter === "prospect") return client.cases.length === 0;
    if (filter === "after-sale") return client.cases.some((item) => /completed|vendu|après/i.test(item.status));
    return client.cases.some((item) => !/completed|vendu|après/i.test(item.status));
  }), [clients, filter]);

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-teal-700">CRM unifié</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Clients & dossiers</h1><p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">Une personne, une fiche client, plusieurs dossiers dans le temps.</p></div><div className="flex flex-wrap gap-2"><Link href="/tableau-de-bord/inscriptions/nouvelle" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Nouveau vendeur</Link><Link href="/tableau-de-bord/acheteurs/nouveau" className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Nouvel acheteur</Link></div></header>
    <SessionStatusNotice />
    <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un client, une adresse ou un dossier" className="min-h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" /></div>
    <nav className="flex flex-wrap gap-2">{filters.map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${filter === key ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>{label}</button>)}</nav>
    {warning ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{warning}</div> : null}{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-700" /></div> : visible.length ? <div className="grid gap-4 xl:grid-cols-2">{visible.map((client) => <ClientCard key={client.id} client={client} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">Aucun client ne correspond à cette vue.</div>}
  </div>;
}

function ClientCard({ client }: { client: Client }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950"><UserRound className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold">{client.name}</h2><p className="mt-1 text-sm text-slate-500">{client.email || client.phone || "Coordonnées à compléter"}</p><div className="mt-2 flex flex-wrap gap-1">{client.roles.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize dark:bg-slate-800">{role === "seller" ? "Vendeur" : role === "buyer" ? "Acheteur" : role}</span>)}</div></div></div></div>
    <div className="mt-5 space-y-2 border-l-2 border-slate-200 pl-4 dark:border-slate-700">{client.cases.length ? client.cases.map((item) => <CaseRow key={`${item.type}-${item.id}`} item={item} />) : <p className="text-sm text-slate-500">Prospect · Aucun dossier actif</p>}</div></article>;
}

function CaseRow({ item }: { item: ClientCase }) {
  const property = Array.isArray(item.property) ? item.property[0] : item.property;
  const seller = item.type === "seller";
  const label = seller ? property?.address || "Dossier vendeur" : "Dossier acheteur";
  const href = seller ? `/tableau-de-bord/inscriptions/${item.id}` : `/tableau-de-bord/acheteurs/${item.id}`;
  const Icon = seller ? Home : KeyRound;
  return <Link href={href} className="flex items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-950"><span className="flex items-center gap-3"><Icon className="h-4 w-4 text-teal-700" /><span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-slate-500">{seller ? "Vendeur" : "Acheteur"} · {formatStatus(item.status)}{typeof item.progress === "number" ? ` · ${item.progress} %` : ""}</span></span></span><ArrowRight className="h-4 w-4 text-slate-400" /></Link>;
}
function formatStatus(value: string) { return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
