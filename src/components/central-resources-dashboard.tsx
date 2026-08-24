"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, FileText, LockKeyhole, Loader2, Search, Sparkles } from "lucide-react";

import { SessionStatusNotice, useDashboardAuth } from "@/components/auth/DashboardAuthProvider";

type Payload = { cases: Array<Record<string, any>>; clients: Array<Record<string, any>>; properties: Array<Record<string, any>>; documents: Array<Record<string, any>>; automations: Array<Record<string, any>> };

export function CentralResourcesDashboard({ mode }: { mode: "documents" | "automations" }) {
  const { status, authenticatedFetch } = useDashboardAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => { if (status !== "authenticated") return; setLoading(true); try { const response = await authenticatedFetch("/api/crm/resources", { cache: "no-store" }); const payload = await response.json() as Payload & { error?: string }; if (!response.ok) throw new Error(payload.error || "Chargement impossible."); setData(payload); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible."); } finally { setLoading(false); } }, [authenticatedFetch, status]);
  useEffect(() => { void load(); }, [load]);
  const cases = useMemo(() => new Map((data?.cases || []).map((item) => [item.id, item])), [data]);
  const clients = useMemo(() => new Map((data?.clients || []).map((item) => [item.id, item])), [data]);
  const properties = useMemo(() => new Map((data?.properties || []).map((item) => [item.id, item])), [data]);
  const rows = (mode === "documents" ? data?.documents : data?.automations) || [];
  const visible = rows.filter((item) => { const client = clients.get(item.client_id); const clientCase = cases.get(item.case_id); const property = properties.get(item.property_id || clientCase?.property_id); return normalize([item.name, item.category, clientCase?.title, client?.first_name, client?.last_name, property?.address].filter(Boolean).join(" ")).includes(normalize(query)); });

  async function toggle(automation: Record<string, any>) { setSaving(automation.id); try { const response = await authenticatedFetch(`/api/client-cases/${automation.case_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "automation", id: automation.id, status: automation.status === "approved" ? "disabled" : "approved" }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "Modification impossible."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Modification impossible."); } finally { setSaving(""); } }

  return <div className="space-y-6"><header><p className="text-sm font-semibold text-teal-700">CRM central</p><h1 className="mt-2 text-3xl font-semibold">{mode === "documents" ? "Documents" : "Automatisations"}</h1><p className="mt-2 text-slate-500">{mode === "documents" ? "Chaque document est relié à un client et à un dossier." : "Toutes les automatisations utilisent les mêmes clients et dossiers; rien n’est envoyé sans validation."}</p></header><SessionStatusNotice />
    <div className="relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par client, dossier, propriété ou catégorie" className="min-h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 dark:border-slate-800 dark:bg-slate-900" /></div>{error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-700" /></div> : visible.length ? <div className="space-y-3">{visible.map((item) => { const clientCase = cases.get(item.case_id); const client = clients.get(item.client_id || clientCase?.primary_client_id); const property = properties.get(item.property_id || clientCase?.property_id); return <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950">{mode === "documents" ? item.is_sensitive ? <LockKeyhole className="h-5 w-5 text-amber-700" /> : <FileText className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</span><div><strong>{item.name}</strong><p className="mt-1 text-sm text-slate-500">{clientName(client)} · {clientCase?.title || "Dossier"}{property?.address ? ` · ${property.address}` : ""}</p><p className="mt-1 text-xs text-slate-500">{mode === "documents" ? `${item.category} · ${label(item.analysis_status)}${item.is_sensitive ? " · privé et journalisé" : ""}` : label(item.status)}</p></div></div><div className="flex gap-2">{mode === "documents" && item.url ? <a href={item.url} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700"><Download className="h-4 w-4" />Télécharger</a> : null}{mode === "automations" ? <button type="button" disabled={saving === item.id} onClick={() => toggle(item)} className="rounded-xl border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-700">{saving === item.id ? "…" : item.status === "approved" ? "Désactiver" : "Valider"}</button> : null}<Link href={`/tableau-de-bord/dossiers/${item.case_id}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Dossier<ArrowRight className="h-4 w-4" /></Link></div></article>; })}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">Aucune ressource CRM pour le moment.</div>}
  </div>;
}

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function clientName(value?: Record<string, any>) { return value ? `${value.first_name || ""} ${value.last_name || ""}`.trim() || "Client" : "Client"; }
function label(value?: string) { return (value || "").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }

