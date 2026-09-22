"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import type { ConnectedAccount, Provider } from "@/lib/connections/types";
export function ConnectedAccounts() {
  const { authenticatedFetch } = useDashboardAuth();
  const [accounts,setAccounts] = useState<ConnectedAccount[]>([]);
  const [configured,setConfigured] = useState({ google: false, microsoft: false });
  const [busy,setBusy] = useState(true), [notice,setNotice] = useState("");
  const load = useCallback(async () => {
    try { const response = await authenticatedFetch("/api/connections", { cache: "no-store" }); const data = await response.json(); setAccounts(data.accounts || []); setConfigured(data.configured || { google: false, microsoft: false }); if (!response.ok) setNotice(data.error); }
    catch { setNotice("Impossible de charger les connexions."); } finally { setBusy(false); }
  },[authenticatedFetch]);
  useEffect(() => { setNotice(new URLSearchParams(window.location.search).get("notice") || ""); void load(); },[load]);
  async function act(provider: Provider, action: string) {
    setBusy(true); setNotice("");
    try { const response = await authenticatedFetch(`/api/connections/${provider}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (data.url) window.location.assign(data.url); else { setNotice(data.message); await load(); } }
    catch(error) { setNotice(error instanceof Error ? error.message : "Connexion impossible."); } finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8"><Link href="/tableau-de-bord/parametres" className="text-blue-700">← Réglages</Link><h1 className="text-2xl font-semibold">Comptes connectés</h1><p className="text-slate-600">Le Coach consulte tes courriels et ton agenda pour préparer ton topo. Les envois et les changements de rendez-vous sont présentés avant confirmation.</p>{notice ? <p role="status" className="rounded-xl border p-4">{notice}</p> : null}<div className="grid gap-4 sm:grid-cols-2">{(["google","microsoft"] as const).map(provider => { const account = accounts.find(a => a.provider === provider); return <article key={provider} className="space-y-4 rounded-2xl border p-5"><h2 className="text-xl font-semibold">{provider === "google" ? "Google" : "Microsoft"}</h2><p>{provider === "google" ? "Gmail + Google Calendar" : "Outlook + Microsoft Calendar"}</p><p className="break-words text-sm">{account ? `${account.email} · ${account.status === "connected" ? "Connecté" : "À reconnecter"}` : configured[provider] ? "Non connecté" : "Configuration administrateur requise"}</p><button disabled={busy || !configured[provider]} onClick={() => void act(provider,"connect")} className="min-h-12 rounded-xl bg-blue-600 px-4 text-white disabled:opacity-40">{account ? "Reconnecter" : "Connecter"}</button>{account ? <button disabled={busy} onClick={() => void act(provider,"disconnect")} className="ml-2 min-h-12 rounded-xl border px-3">Déconnecter</button> : null}</article>; })}</div><p className="text-sm text-slate-500">Un compte par fournisseur. Seul l’agenda principal est utilisé. Aucun mot de passe n’est demandé à IACourtier. Les autorisations peuvent être retirées à tout moment.</p><Link href="/tableau-de-bord/coach" className="inline-block rounded-xl border px-4 py-3">Parler au Coach</Link></section>;
}
