"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, FileText, Loader2, Search, Sparkles, UploadCloud, UserRound, WalletCards } from "lucide-react";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";

type BuyerData = {
  case: {
    id: string;
    client_case_id?: string | null;
    status: string;
    budget?: string | null;
    preapproval_status: string;
    sectors: string[];
    property_type?: string | null;
    bedrooms?: string | null;
    important_needs?: string | null;
    timeline?: string | null;
    property_to_sell?: boolean | null;
    contact: { id: string; first_name: string; last_name: string; email?: string; phone?: string; mailing_address?: string } | Array<{ id: string; first_name: string; last_name: string; email?: string; phone?: string; mailing_address?: string }>;
  };
  documents: Array<{ id: string; name: string; document_type: string }>;
  tasks: Array<{ id: string; title: string; category: string; status: "pending" | "completed" }>;
  automations: Array<{ id: string; name: string; status: "validation_required" | "approved" | "disabled" }>;
  activity: Array<{ id: string; title: string; details?: string; created_at: string }>;
  financing: { status: string; maximum_purchase_price?: number | null; down_payment?: number | null; mortgage_amount?: number | null; occupancy_type?: string | null; lender?: string | null; preapproval_date?: string | null; expiry_date?: string | null } | null;
  partners: Array<{ id: string; role: string; partner: { id: string; first_name: string; last_name: string; organization?: string | null; email?: string | null; phone?: string | null; partner_type: string } | Array<{ id: string; first_name: string; last_name: string; organization?: string | null; email?: string | null; phone?: string | null; partner_type: string }> }>;
  progress: number;
  missingFields: string[];
  nextAction: string;
};

export function BuyerCaseWorkspace({ id }: { id: string }) {
  const { authenticatedFetch } = useDashboardAuth();
  const [data, setData] = useState<BuyerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/buyer-cases/${id}`, { cache: "no-store" });
      const payload = await response.json() as BuyerData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Le dossier acheteur n’a pas pu être chargé.");
      setData(payload);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le dossier acheteur n’a pas pu être chargé.");
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const key = `iacourtier-buyer-notice-${id}`;
    const value = window.sessionStorage.getItem(key);
    if (value) { setNotice(value); window.sessionStorage.removeItem(key); }
  }, [id]);

  async function patch(body: Record<string, unknown>, key: string, success?: string) {
    setBusy(key);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/buyer-cases/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "La mise à jour a échoué.");
      if (success) setNotice(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La mise à jour a échoué.");
    } finally { setBusy(""); }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("documents");
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      const response = await authenticatedFetch(`/api/buyer-cases/${id}/documents`, { method: "POST", body: form });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Le téléversement a échoué.");
      setNotice("Les documents sont classés dans ce dossier acheteur.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Le téléversement a échoué."); }
    finally { setBusy(""); }
  }

  if (loading && !data) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-700" /></div>;
  if (!data) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><h1 className="text-xl font-semibold">Dossier indisponible</h1><p className="mt-2">{error}</p><Link href="/tableau-de-bord/acheteurs/nouveau" className="mt-4 inline-flex font-semibold underline">Créer un dossier acheteur</Link></div>;

  const contact = Array.isArray(data.case.contact) ? data.case.contact[0] : data.case.contact;
  const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : "Acheteur";
  const guideReady = data.missingFields.length === 0;

  return <div className="space-y-7">
    <div className="flex flex-wrap gap-4 text-sm font-semibold"><Link href="/tableau-de-bord/clients" className="text-slate-600">← Clients & dossiers</Link>{data.case.client_case_id ? <Link href={`/tableau-de-bord/dossiers/${data.case.client_case_id}`} className="text-teal-700">Voir le dossier unifié →</Link> : null}</div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-start"><div><p className="text-sm font-semibold text-teal-700">Dossier acheteur · Validation requise</p><h1 className="mt-2 text-3xl font-semibold">{name}</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Acheteur · {labelStatus(data.case.status)}</p><div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/20 dark:text-teal-100"><strong>Prochaine action :</strong> {data.nextAction}</div><a href="#etapes" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white">Continuer le dossier</a></div><div className="min-w-52 rounded-2xl bg-slate-950 p-5 text-white dark:bg-white dark:text-slate-950"><p className="text-xs font-semibold uppercase tracking-wide opacity-70">Progression</p><p className="mt-1 text-4xl font-semibold">{data.progress} %</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-teal-400" style={{ width: `${data.progress}%` }} /></div></div></div>
      <nav className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">{[["resume","Résumé"],["client","Client"],["criteres","Critères"],["documents","Documents"],["etapes","Étapes"],["automatisations","Automatisations"],["communications","Communications"]].map(([href,label]) => <a key={href} href={`#${href}`} className="rounded-full px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">{label}</a>)}</nav>
    </section>
    {error ? <Alert text={error} tone="red" /> : null}{notice ? <Alert text={notice} tone="green" /> : null}

    <section id="resume" className="grid scroll-mt-6 gap-4 lg:grid-cols-2"><Panel title="Ce qui vient d’être fait" icon={Check}><p className="text-sm text-slate-600 dark:text-slate-300">La fiche client a été identifiée ou reliée, le dossier acheteur et son parcours ont été créés, puis les tâches et automatisations ont été préparées.</p></Panel><Panel title="Ce qui manque" icon={Search}>{data.missingFields.length ? <ul className="space-y-2 text-sm">{data.missingFields.map((item) => <li key={item}>□ {item}</li>)}</ul> : <p className="text-sm text-teal-700">Les critères essentiels sont complets.</p>}</Panel></section>
    <section id="client" className="scroll-mt-6"><Panel title="Client" icon={UserRound}><Definition items={[["Nom",name],["Courriel",contact?.email],["Téléphone",contact?.phone],["Adresse",contact?.mailing_address]]} /></Panel></section>
    <section id="criteres" className="grid scroll-mt-6 gap-4 lg:grid-cols-2"><Panel title="Qualification, financement et critères" icon={WalletCards}><Definition items={[["Budget maximal",data.financing?.maximum_purchase_price ?? data.case.budget],["Préqualification",labelPreapproval(data.financing?.status || data.case.preapproval_status)],["Mise de fonds",money(data.financing?.down_payment)],["Montant hypothécaire",money(data.financing?.mortgage_amount)],["Occupation",data.financing?.occupancy_type],["Prêteur",data.financing?.lender],["Secteurs",data.case.sectors.join(", ")],["Type",data.case.property_type],["Chambres",data.case.bedrooms],["Besoins",data.case.important_needs],["Échéancier",data.case.timeline],["Propriété à vendre",data.case.property_to_sell == null ? null : data.case.property_to_sell ? "Oui" : "Non"]]} /></Panel><Panel title="Partenaires reliés" icon={UserRound}>{data.partners.length ? data.partners.map((relation) => { const partner = Array.isArray(relation.partner) ? relation.partner[0] : relation.partner; return partner ? <div key={relation.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p className="font-semibold">{`${partner.first_name} ${partner.last_name}`.trim() || partner.organization}</p><p className="text-xs text-slate-500">{partnerTypeLabel(partner.partner_type)} · {partner.email || partner.phone || "Coordonnées à compléter"}</p></div> : null; }) : <p className="text-sm text-slate-500">Aucun partenaire relié.</p>}</Panel></section>
    <section id="documents" className="scroll-mt-6"><Panel title="Documents" icon={UploadCloud}><Link href={data.case.client_case_id ? `/tableau-de-bord/dossiers/${data.case.client_case_id}?add=document#ajouter-source` : "/tableau-de-bord/importer"} className="inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Ajouter et analyser des documents</Link><p className="text-xs text-slate-500">Tous les documents passent par le moteur central : extraction, fusion, classement et mise à jour du parcours.</p>{data.documents.length ? <div className="grid gap-2 sm:grid-cols-2">{data.documents.map((document) => <div key={document.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p className="font-semibold">{document.name}</p><p className="text-xs text-slate-500">{document.document_type}</p></div>)}</div> : <p className="text-sm text-slate-500">Aucun document sauvegardé.</p>}</Panel></section>
    <section id="etapes" className="scroll-mt-6"><Panel title="Étapes et tâches" icon={Check}>{data.tasks.map((task) => <label key={task.id} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input type="checkbox" checked={task.status === "completed"} onChange={(event) => patch({ action: "task", taskId: task.id, status: event.target.checked ? "completed" : "pending" }, `task-${task.id}`)} /><span><span className="block text-sm font-semibold">{task.title}</span><span className="text-xs text-slate-500">{task.category} · validation humaine</span></span></label>)}</Panel></section>
    <section id="automatisations" className="scroll-mt-6"><Panel title="Automatisations proposées" icon={Sparkles}>{data.automations.map((automation) => <div key={automation.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div><p className="text-sm font-semibold">{automation.name}</p><p className="text-xs text-slate-500">{automation.status === "approved" ? "Plan validé · aucun envoi externe" : "Validation requise"}</p></div><button type="button" onClick={() => patch({ action: "automation", automationId: automation.id, status: automation.status === "approved" ? "validation_required" : "approved" }, `automation-${automation.id}`)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">{automation.status === "approved" ? "Révoquer" : "Valider"}</button></div>)}</Panel></section>
    <section id="communications" className="scroll-mt-6"><Panel title="Guide acheteur" icon={FileText}><p className="text-sm text-slate-600 dark:text-slate-300">Le guide personnalisé utilisera cette fiche et ces critères. Il demeure un brouillon interne jusqu’à validation du courtier.</p><button type="button" disabled={!guideReady} className="mt-3 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Préparer le guide acheteur</button>{!guideReady ? <p className="mt-2 text-xs text-amber-700">Complète d’abord les informations essentielles manquantes.</p> : null}</Panel></section>
    <section className="rounded-2xl bg-slate-950 p-6 text-white dark:bg-white dark:text-slate-950"><p className="flex items-center gap-2 text-sm font-semibold text-teal-300 dark:text-teal-700"><Sparkles className="h-4 w-4" />Coach IA · contexte de ce dossier</p><p className="mt-4 text-xl font-semibold">{data.nextAction}</p></section>
  </div>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Check; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-teal-700" />{title}</h2><div className="space-y-3">{children}</div></section>; }
function Definition({ items }: { items: Array<[string, unknown]> }) { return <dl className="grid gap-3 sm:grid-cols-2">{items.map(([label,value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium">{String(value || "À compléter")}</dd></div>)}</dl>; }
function Alert({ text, tone }: { text: string; tone: "red" | "green" }) { return <div className={`rounded-xl border p-4 text-sm ${tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{text}</div>; }
function labelStatus(status: string) { return ({ qualification: "Qualification", financing: "Financement", active_search: "Recherche active", visits: "Visites", offer: "Offre", conditions: "Conditions", notary: "Notaire", completed: "Après-vente" } as Record<string,string>)[status] || status; }
function labelPreapproval(status: string) { return ({ missing: "À obtenir", requested: "Demandée", received: "Reçue", approved: "Validée" } as Record<string,string>)[status] || status; }
function money(value?: number | null) { return typeof value === "number" ? new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value) : null; }
function partnerTypeLabel(type: string) { return ({ mortgage_broker: "Courtier hypothécaire", real_estate_broker: "Courtier immobilier", notary: "Notaire", inspector: "Inspecteur", lender: "Prêteur", other: "Autre partenaire" } as Record<string,string>)[type] || type; }

