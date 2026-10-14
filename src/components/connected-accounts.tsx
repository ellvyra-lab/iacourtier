"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import type { ConnectedAccount, ConnectionService, Provider } from "@/lib/connections/types";
import { unconfiguredCentris, type CentrisConnection } from "@/lib/centris/provider";

export function ConnectedAccounts() {
  const { authenticatedFetch } = useDashboardAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [configured, setConfigured] = useState({ google: false, microsoft: false });
  const [centris, setCentris] = useState<CentrisConnection>(unconfiguredCentris);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const [services,setServices] = useState<ConnectionService[]>(["email","calendar"]);
  const labels: Record<ConnectionService,string> = {email:"Courriels",calendar:"Calendar",contacts:"Contacts (lecture seulement)"};
  const load = useCallback(async () => {
    const response = await authenticatedFetch("/api/connections", { cache: "no-store" });
    const data = await response.json();
    setAccounts(data.accounts || []);
    setConfigured(data.configured || { google: false, microsoft: false });
    setCentris(data.centris || unconfiguredCentris);
    if (!response.ok) throw new Error(data.error || "Connexions indisponibles.");
  }, [authenticatedFetch]);
  useEffect(() => {
    setNotice(new URLSearchParams(window.location.search).get("notice") || "");
    void load().catch(e => setNotice(e instanceof Error ? e.message : "Connexions indisponibles.")).finally(() => setBusy(false));
  }, [load]);
  async function act(provider: Provider, action: "connect" | "disconnect" | "verify" | "default", account?: ConnectedAccount, service?: ConnectionService) {
    setBusy(true); setNotice("");
    try {
      const response = await authenticatedFetch(`/api/connections/${provider}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action,accountId:account?.id,service,services:account?.services || services }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.url) window.location.assign(data.url);
      else { await load(); setNotice(data.message); }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connexion impossible.";
      await load().catch(() => {});
      setNotice(message);
    } finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <Link href="/tableau-de-bord/parametres" className="text-blue-700">← Réglages</Link>
    <h1 className="text-2xl font-semibold">Connexions</h1>
    <p className="text-slate-600">Connecte tes services pour que le Coach consulte tes courriels et ton agenda. Chaque compte appartient uniquement à ton espace IACourtier.</p>
    {notice ? <p role="status" className="rounded-xl border p-4">{notice}</p> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      {(["google", "microsoft"] as const).map(provider => {
        return <article key={provider} className="space-y-4 rounded-2xl border p-5">
          <h2 className="text-xl font-semibold">{provider === "google" ? "Google" : "Microsoft"}</h2>
          <p>{provider === "google" ? "Gmail · Calendar · Contacts" : "Outlook + Microsoft Calendar"}</p>
          {accounts.filter(a => a.provider === provider).map(account => <div key={account.id} className="space-y-2 rounded-xl border p-3">
            <p className="break-words font-medium">{account.email}</p>
            <p className="text-sm">{account.status === "connected" ? "Connecté" : account.status === "disconnected" ? "Déconnecté" : "Reconnexion nécessaire"}</p>
            <p className="text-xs text-slate-600">Connexion : {account.connected_at ? new Date(account.connected_at).toLocaleString("fr-CA") : "date historique inconnue"}{account.reconnected_at ? ` · Reconnexion : ${new Date(account.reconnected_at).toLocaleString("fr-CA")}` : ""}</p>
            {account.services?.map(service => <div key={service} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{labels[service]}</span>{account.defaults?.includes(service) ? <strong>Par défaut</strong> : <button disabled={busy || account.status !== "connected"} className="rounded border p-2 disabled:opacity-40" onClick={() => void act(provider,"default",account,service)}>Utiliser par défaut</button>}</div>)}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy || !configured[provider]} onClick={() => void act(provider,"connect",account)} className="min-h-12 rounded-xl border px-3 disabled:opacity-40">Reconnecter</button>
              {account.status !== "disconnected" ? <button disabled={busy} onClick={() => void act(provider,"disconnect",account)} className="min-h-12 rounded-xl border px-3">Déconnecter et révoquer</button> : null}
              <button disabled={busy || account.status !== "connected" || !configured[provider]} onClick={() => void act(provider,"verify",account)} className="min-h-12 rounded-xl border px-3 disabled:opacity-40">Vérifier l’accès</button>
            </div>
          </div>)}
          {!configured[provider] ? <p className="text-sm text-amber-700">Configuration administrateur requise avant de connecter ce service.</p> : null}
          <div className="flex flex-wrap gap-2">
            {provider === "google" ? <fieldset className="w-full space-y-2"><legend>Services du nouveau compte</legend>{(["email","calendar","contacts"] as const).map(service => <label key={service} className="flex items-center gap-2"><input type="checkbox" checked={services.includes(service)} disabled={busy} onChange={e => setServices(current => e.target.checked ? [...current,service] : current.filter(s => s !== service))}/>{labels[service]}</label>)}</fieldset> : null}
            <button disabled={busy || !configured[provider] || provider === "google" && !services.length} onClick={() => void act(provider, "connect")} className="min-h-12 rounded-xl bg-blue-600 px-4 text-white disabled:opacity-40">Ajouter un compte</button>
          </div>
        </article>;
      })}
      <article className="space-y-4 rounded-2xl border p-5 sm:col-span-2">
        <h2 className="text-xl font-semibold">Centris</h2>
        <p className="text-sm font-medium">{centris.label}</p><p>{centris.message}</p>
        <details className="rounded-xl border p-3"><summary className="cursor-pointer font-medium">Configurer l’intégration officielle</summary>
          <div className="mt-3 space-y-2 text-sm"><p>L’administrateur doit obtenir l’autorisation de Centris pour IACourtier, les services et données permis, ainsi que la méthode d’authentification officielle.</p>
            <p>Aucun mot de passe Centris n’est demandé. La recherche et la synchronisation seront activées seulement après validation de cet accès.</p>
            <p>La préparation manuelle des dossiers reste disponible. Le CRM, Gmail, Calendar et le Coach fonctionnent indépendamment de Centris.</p></div>
        </details>
      </article>
    </div>
    <p className="text-sm text-slate-500">Plusieurs comptes indépendants, agenda principal de chaque compte. Les messages et changements de rendez-vous nécessitent une confirmation. Les analyses sont déclenchées à la demande.</p>
    <p className="text-sm text-slate-500">Les autorisations sont enregistrées de façon chiffrée côté serveur. Aucun mot de passe n’est conservé. Tu peux déconnecter tes services à tout moment.</p>
    <Link href="/tableau-de-bord/coach" className="inline-block rounded-xl border px-4 py-3">Parler au Coach</Link>
  </section>;
}
