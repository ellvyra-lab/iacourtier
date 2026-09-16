"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clipboard, Download, FileText, Image as ImageIcon, Loader2, LockKeyhole } from "lucide-react";

import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import type { CentrisPreparation } from "@/lib/centris/preparation";

export function CentrisPreparationWorkspace({ listingId }: { listingId: string }) {
  const { status, authenticatedFetch } = useDashboardAuth();
  const [data, setData] = useState<CentrisPreparation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/seller-listings/${listingId}/centris`, { cache: "no-store" });
      const payload = await response.json() as CentrisPreparation & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Préparation Centris impossible.");
      setData(payload); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Préparation Centris impossible."); }
    finally { setLoading(false); }
  }, [authenticatedFetch, listingId, status]);

  useEffect(() => { void load(); }, [load]);

  async function validate() {
    setBusy("validate"); setError("");
    try {
      const response = await authenticatedFetch(`/api/seller-listings/${listingId}/centris`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "validate" }) });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "Validation impossible.");
      setNotice(payload.message || "Préparation validée.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Validation impossible."); }
    finally { setBusy(""); }
  }

  async function copyPayload() {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data.payload, null, 2));
    setNotice("Données copiées dans le presse-papiers.");
  }

  function exportPayload(format: "json" | "txt") {
    if (!data) return;
    const content = format === "json" ? JSON.stringify(data.payload, null, 2) : data.fields.map((field) => `${field.label}: ${field.value || "À compléter"}`).join("\n");
    const blob = new Blob([content], { type: format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `centris-${listingId}.${format}`; link.click(); URL.revokeObjectURL(url);
  }

  if (loading || !data) return <div className="flex min-h-80 items-center justify-center">{error ? <p className="text-red-700">{error}</p> : <Loader2 className="h-8 w-8 animate-spin text-teal-700" />}</div>;

  return <div className="mx-auto max-w-6xl space-y-6">
    <nav className="text-sm"><Link href={`/tableau-de-bord/inscriptions/${listingId}`} className="font-semibold text-teal-700">← Retour au dossier vendeur</Link></nav>
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-semibold text-teal-700">Préparation sécurisée</p><h1 className="mt-1 text-3xl font-semibold">Préparer pour Centris</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Vérifiez les champs, les sources, les photos et la description avant copie ou export.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">Connexion Centris : {data.connection.label}</span></div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-teal-600" style={{ width: `${data.completion}%` }} /></div><p className="mt-2 text-sm text-slate-500">{data.completion} % prêt · {data.sourceCount} source(s) · confiance moyenne {data.averageConfidence == null ? "à confirmer" : `${Math.round(data.averageConfidence * 100)} %`}</p>
    </header>
    {error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}{notice ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p> : null}
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex gap-3"><LockKeyhole className="h-5 w-5 shrink-0" /><div><strong>Aucune transmission automatique</strong><p className="mt-1">{data.transmissionMessage}</p></div></div></section>
    {(data.missingFields.length || data.conflicts.length) ? <section className="grid gap-3 md:grid-cols-2">{data.missingFields.length ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><h2 className="font-semibold text-red-900">Champs obligatoires manquants</h2>{data.missingFields.map((item) => <p key={item} className="mt-2 flex gap-2 text-sm text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />{item}</p>)}</div> : null}{data.conflicts.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-semibold text-amber-900">À confirmer</h2>{data.conflicts.map((item) => <p key={item} className="mt-2 text-sm text-amber-800">{item}</p>)}</div> : null}</section> : null}
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Champs préparés</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{data.fields.map((field) => <article key={field.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><strong className="text-sm">{field.label}{field.required ? " *" : ""}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${field.status === "ready" ? "bg-emerald-100 text-emerald-900" : field.status === "to_confirm" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-900"}`}>{field.status === "ready" ? "Prêt" : field.status === "to_confirm" ? "À confirmer" : "Manquant"}</span></div><p className="mt-2 text-sm">{field.value || "À compléter"}</p><p className="mt-2 text-xs text-slate-500">Source : {field.source}{field.confidence == null ? "" : ` · ${Math.round(field.confidence * 100)} %`}</p></article>)}</div></section>
    <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="flex items-center gap-2 font-semibold"><FileText className="h-5 w-5 text-teal-700" />Documents ({data.documents.length})</h2><div className="mt-3 space-y-2">{data.documents.map((document) => <p key={document.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><strong>{document.name}</strong><span className="block text-xs text-slate-500">{document.type} · {document.status}</span></p>)}</div></div><div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="flex items-center gap-2 font-semibold"><ImageIcon className="h-5 w-5 text-teal-700" />Photos ({data.photos.length})</h2><div className="mt-3 space-y-2">{data.photos.map((photo) => <p key={photo.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">{photo.position + 1}. {photo.name}{photo.isCover ? " · principale" : ""}</p>)}</div></div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold">Description destinée à la diffusion</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{data.description || "Description à préparer."}</p></section>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void copyPayload()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold dark:border-slate-700"><Clipboard className="h-4 w-4" />Copier</button><button type="button" onClick={() => exportPayload("txt")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold dark:border-slate-700"><Download className="h-4 w-4" />Exporter TXT</button><button type="button" onClick={() => exportPayload("json")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold dark:border-slate-700"><Download className="h-4 w-4" />Exporter JSON</button><button type="button" onClick={() => void validate()} disabled={!data.canValidate || busy === "validate"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 font-semibold text-white disabled:opacity-50">{busy === "validate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Valider la préparation</button><button type="button" disabled title={data.transmissionMessage} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-300 px-4 font-semibold text-slate-600">Transmettre à Centris</button></div>
  </div>;
}
