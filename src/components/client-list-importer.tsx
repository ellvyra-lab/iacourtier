"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Search, ShieldCheck, Sparkles, Tags, UploadCloud, UsersRound } from "lucide-react";

import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";

type Preview = {
  summary: { rowsDetected: number; uniqueClientsProjected: number; newClients: number; existingClients: number; certainDuplicates: number; ambiguousDuplicates: number; incompleteLines: number; unimportableLines: number };
  mappings: Array<{ index: number; source: string; field: string; label: string; confidence: number }>;
  unrecognizedColumns: string[];
  tagCounts: Record<string, number>;
  recommendedAutomations: Array<{ key: string; label: string; eligible: number; reason: string; enabled: false }>;
  ambiguousExamples: Array<{ rowNumber: number; name: string; email: string; phone: string; matches: Array<{ id: string; name: string; email: string; phone: string }> }>;
  incompleteExamples: Array<{ rowNumber: number; name: string; missing: string[]; warnings: string[] }>;
};
type Analysis = { file: { name: string; size: number; fingerprint: string; sheetName: string }; previousImports: Array<{ id: string; created_at: string; status: string }>; preview: Preview };
type Report = { rowsAnalyzed: number; created: number; updated: number; unchanged: number; mergedDuplicates: number; needsReview: number; skipped: number; incomplete: number; mortgageRenewalMissing: number; automaticMessagesSent: number };
type Result = { importId: string; report: Report; coachMessage: string; recommendedAutomations: Preview["recommendedAutomations"] };

export function ClientListImporter() {
  const { authenticatedFetch } = useDashboardAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<"idle" | "analyzing" | "importing">("idle");
  const [error, setError] = useState("");
  const [certainAction, setCertainAction] = useState<"merge" | "keep" | "ignore">("merge");
  const [ambiguousAction, setAmbiguousAction] = useState<"review" | "merge" | "keep" | "ignore">("review");
  const [enabledTags, setEnabledTags] = useState<string[]>([]);

  const preview = analysis?.preview;
  const detectedTags = useMemo(() => Object.keys(preview?.tagCounts || {}), [preview]);

  function receiveFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setAnalysis(null);
    setResult(null);
    setError("");
  }

  async function analyze() {
    if (!file) return;
    setStatus("analyzing");
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await authenticatedFetch("/api/client-import/analyze", { method: "POST", body });
      const payload = await response.json() as Analysis & { error?: string };
      if (!response.ok || !payload.preview) throw new Error(payload.error || "L’analyse de la liste a échoué.");
      setAnalysis(payload);
      setEnabledTags(Object.keys(payload.preview.tagCounts));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’analyse de la liste a échoué.");
    } finally { setStatus("idle"); }
  }

  async function confirmImport() {
    if (!file || !analysis) return;
    setStatus("importing");
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("fingerprint", analysis.file.fingerprint);
      body.append("decisions", JSON.stringify({ certainAction, ambiguousAction, enabledTags }));
      const response = await authenticatedFetch("/api/client-import/confirm", { method: "POST", body });
      const payload = await response.json() as Result & { error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error || "L’import n’a pas pu être terminé.");
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’import n’a pas pu être terminé.");
    } finally { setStatus("idle"); }
  }

  if (result) return <ImportResult result={result} onRestart={() => { setFile(null); setAnalysis(null); setResult(null); setError(""); if (inputRef.current) inputRef.current.value = ""; }} />;

  return <div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-sm font-semibold text-teal-700">Import intelligent CRM</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Importer ma liste de clients</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">CSV, XLSX, XLS ou export CSV de Google Contacts. IACourtier reconnaît les colonnes, normalise les coordonnées et recherche les doublons avant toute écriture.</p></header>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={receiveFile} className="sr-only" />
      <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-5 text-center transition hover:border-teal-500 hover:bg-teal-50 dark:border-slate-700 dark:hover:bg-teal-950/20">
        <UploadCloud className="h-8 w-8 text-teal-700" /><span className="mt-3 font-semibold">{file ? file.name : "Choisir une liste de clients"}</span><span className="mt-1 text-xs text-slate-500">CSV, XLSX ou XLS · maximum 15 Mo et 25 000 lignes</span>
      </button>
      {file ? <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{file.name}</span><span className="text-xs text-slate-500">{formatBytes(file.size)}</span></span><button type="button" disabled={status !== "idle"} onClick={() => void analyze()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{status === "analyzing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{status === "analyzing" ? "Analyse en cours…" : analysis ? "Relancer l’analyse" : "Analyser sans importer"}</button></div> : null}
    </section>

    {status === "analyzing" ? <Notice icon={Loader2} tone="teal" title="Lecture des colonnes et recherche des doublons…">Aucune fiche n’est créée pendant cette étape. Les milliers de lignes sont traités en lot.</Notice> : null}
    {error ? <Notice icon={AlertTriangle} tone="red" title="L’opération a échoué">{error}</Notice> : null}

    {preview ? <>
      {analysis.previousImports.length ? <Notice icon={RefreshCw} tone="amber" title="Ce fichier a déjà été importé">IACourtier comparera de nouveau chaque ligne aux fiches actuelles et ajoutera seulement les informations manquantes.</Notice> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <SummaryCard label="Lignes" value={preview.summary.rowsDetected} />
        <SummaryCard label="Nouveaux" value={preview.summary.newClients} />
        <SummaryCard label="Existants" value={preview.summary.existingClients} />
        <SummaryCard label="Doublons certains" value={preview.summary.certainDuplicates} />
        <SummaryCard label="Cas ambigus" value={preview.summary.ambiguousDuplicates} attention={preview.summary.ambiguousDuplicates > 0} />
        <SummaryCard label="Lignes incomplètes" value={preview.summary.incompleteLines} attention={preview.summary.incompleteLines > 0} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel icon={FileSpreadsheet} title="Colonnes reconnues">
          <div className="max-h-80 space-y-2 overflow-y-auto">{preview.mappings.map((mapping) => <div key={`${mapping.index}-${mapping.field}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><span className="truncate">{mapping.source}</span><span className="shrink-0 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-100">{mapping.label}</span></div>)}</div>
          {preview.unrecognizedColumns.length ? <p className="text-xs text-slate-500">Non utilisées : {preview.unrecognizedColumns.join(", ")}</p> : <p className="text-xs text-emerald-700">Toutes les colonnes ont été reconnues.</p>}
        </Panel>
        <Panel icon={ShieldCheck} title="Règles de doublons">
          <Decision label="Doublons certains" value={certainAction} onChange={(value) => setCertainAction(value as typeof certainAction)} options={[["merge","Fusionner automatiquement"],["keep","Garder les deux"],["ignore","Ignorer les doublons"]]} />
          <Decision label="Cas ambigus" value={ambiguousAction} onChange={(value) => setAmbiguousAction(value as typeof ambiguousAction)} options={[["review","Examiner plus tard"],["merge","Fusionner si une seule fiche correspond"],["keep","Garder les deux"],["ignore","Ignorer"]]} />
          <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950 dark:text-slate-300">Priorité : courriel exact, téléphone normalisé, prénom + nom + adresse, puis prénom + nom comme correspondance ambiguë. Les valeurs CRM existantes sont conservées en cas de conflit.</p>
        </Panel>
      </section>

      <Panel icon={Tags} title="Tags automatiques — modifiables avant l’import">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{detectedTags.map((tag) => <label key={tag} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800"><input type="checkbox" checked={enabledTags.includes(tag)} onChange={() => setEnabledTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} /><span className="flex-1">{tag}</span><strong>{preview.tagCounts[tag].toLocaleString("fr-CA")}</strong></label>)}</div>
      </Panel>

      {preview.ambiguousExamples.length ? <Panel icon={AlertTriangle} title="Exemples de cas ambigus"><p className="text-sm text-slate-500">Décision globale appliquée; aucune validation ligne par ligne n’est requise.</p><div className="max-h-72 space-y-2 overflow-y-auto">{preview.ambiguousExamples.map((row) => <div key={row.rowNumber} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"><strong>Ligne {row.rowNumber} · {row.name}</strong><span className="mt-1 block text-xs">{row.email || row.phone || "Coordonnées absentes"}{row.matches.length ? ` · correspond à ${row.matches.map((item) => item.name).join(", ")}` : " · nom répété dans le fichier"}</span></div>)}</div></Panel> : null}

      <Panel icon={Sparkles} title="Plan d’automatisations recommandé"><Notice icon={ShieldCheck} tone="teal" title="Plan seulement — aucun envoi automatique">Après l’import, tu pourras examiner et activer séparément les campagnes voulues.</Notice><div className="grid gap-3 sm:grid-cols-2">{preview.recommendedAutomations.map((item) => <div key={item.key} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><strong className="text-sm">{item.label}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{item.eligible.toLocaleString("fr-CA")} admissibles</span></div><p className="mt-2 text-xs text-slate-500">{item.reason}</p></div>)}</div></Panel>

      <section className="sticky bottom-3 z-10 rounded-2xl border border-slate-300 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Prêt à créer ou mettre à jour les fiches</p><p className="text-xs text-slate-500">Aucune donnée existante conflictuelle ne sera remplacée et aucun message ne sera envoyé.</p></div><button type="button" disabled={status !== "idle"} onClick={() => void confirmImport()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">{status === "importing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <UsersRound className="h-5 w-5" />}{status === "importing" ? "Import en cours…" : "Confirmer l’import"}</button></div></section>
    </> : null}
  </div>;
}

function ImportResult({ result, onRestart }: { result: Result; onRestart: () => void }) {
  const report = result.report;
  return <section className="mx-auto max-w-4xl space-y-6"><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20 sm:p-8"><CheckCircle2 className="h-10 w-10 text-emerald-700" /><h1 className="mt-4 text-2xl font-semibold">Import terminé et vérifié</h1><p className="mt-4 whitespace-pre-line text-sm leading-7">{result.coachMessage}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><SummaryCard label="Créées" value={report.created} /><SummaryCard label="Mises à jour" value={report.updated} /><SummaryCard label="Fusionnées" value={report.mergedDuplicates} /><SummaryCard label="À vérifier" value={report.needsReview} attention={report.needsReview > 0} /><SummaryCard label="Ignorées" value={report.skipped} /><SummaryCard label="Messages envoyés" value={report.automaticMessagesSent} /></div><div className="flex flex-wrap gap-3"><Link href="/tableau-de-bord/clients" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-5 font-semibold text-white">Voir mes clients <ArrowRight className="h-4 w-4" /></Link><button type="button" onClick={onRestart} className="min-h-12 rounded-xl border border-slate-300 px-5 font-semibold dark:border-slate-700">Importer une autre liste</button></div></section>;
}

function Panel({ icon: Icon, title, children }: { icon: typeof Search; title: string; children: React.ReactNode }) { return <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-teal-700" />{title}</h2>{children}</section>; }
function SummaryCard({ label, value, attention }: { label: string; value: number; attention?: boolean }) { return <div className={`rounded-2xl border p-4 ${attention ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value.toLocaleString("fr-CA")}</p></div>; }
function Decision({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function Notice({ icon: Icon, tone, title, children }: { icon: typeof AlertTriangle; tone: "teal" | "amber" | "red"; title: string; children: React.ReactNode }) { const styles = tone === "red" ? "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100" : tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100" : "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900 dark:bg-teal-950/20 dark:text-teal-100"; return <div className={`flex items-start gap-3 rounded-2xl border p-4 ${styles}`}><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${Icon === Loader2 ? "animate-spin" : ""}`} /><div><p className="text-sm font-semibold">{title}</p><div className="mt-1 text-xs leading-5">{children}</div></div></div>; }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`; }
