"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, ChevronRight, FileUp, Keyboard, Loader2, Mic, MoreHorizontal, Phone, Sparkles, X } from "lucide-react";

import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { VoiceDictationButton } from "@/components/voice-dictation-button";

type Processed = { clientId: string; caseId: string; clientName: string; caseLabel: string; createdClient: boolean; createdCase: boolean; taskCount: number; tasks: Array<{ title: string; dueAt: string | null; dueOn: string | null; dueLabel: string | null }>; updated: string[] };
type AnalysisPayload = { captureId: string; analysis: any; engine: string; potentialDuplicates: Array<any>; suggestedClientId: string | null; requiresChoice: boolean; autoProcessed?: boolean; processed?: Processed };
type RecentCapture = { id: string; raw_text: string; status: string; source_type: string; analysis: any; client_id: string | null; case_id: string | null; captured_at: string };
const choices = [
  { type: "text", label: "Écrire", icon: Keyboard },
  { type: "image", label: "Photo / capture", icon: Camera, href: "/tableau-de-bord/importer?source=image" },
  { type: "document", label: "Document", icon: FileUp, href: "/tableau-de-bord/importer?source=document" },
  { type: "call", label: "Appels à faire", icon: Phone, href: "/tableau-de-bord/appels" },
  { type: "other", label: "Autre", icon: MoreHorizontal },
];

export function UniversalQuickCapture({ floating = false }: { floating?: boolean }) {
  const { status, authenticatedFetch } = useDashboardAuth();
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState("voice");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Processed | null>(null);
  const [recent, setRecent] = useState<RecentCapture[]>([]);

  const loadRecent = useCallback(async () => {
    if (status !== "authenticated") return;
    try { const response = await authenticatedFetch("/api/crm/inbox/recent", { cache: "no-store" }); const payload = await response.json(); if (response.ok) setRecent(payload.captures || []); } catch { /* La capture principale demeure utilisable. */ }
  }, [authenticatedFetch, status]);
  useEffect(() => { if (!floating) void loadRecent(); }, [floating, loadRecent]);
  useEffect(() => { if (open && floating) void loadRecent(); }, [floating, loadRecent, open]);

  function begin(type = "voice") { setSourceType(type); setOpen(true); setAnalysis(null); setCreated(null); setText(""); setClientId(null); setError(""); }
  async function analyze(capturedText = text) {
    const note = capturedText.trim();
    if (!note) return;
    setBusy(true); setError("");
    try {
      const response = await authenticatedFetch("/api/crm/inbox/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: note, sourceType }) });
      const payload = await response.json() as AnalysisPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Analyse impossible.");
      setAnalysis(payload);
      setClientId(payload.suggestedClientId || null);
      if (payload.autoProcessed && payload.processed) { setCreated(payload.processed); setAnalysis(payload); await loadRecent(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Analyse impossible."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!analysis || !clientId) { setError("Choisis la bonne personne pour éviter un doublon."); return; }
    setBusy(true); setError("");
    try {
      const response = await authenticatedFetch("/api/crm/inbox/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ captureId: analysis.captureId, clientId }) });
      const payload = await response.json() as Processed & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Traitement impossible.");
      setCreated(payload); await loadRecent();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Traitement impossible."); }
    finally { setBusy(false); }
  }
  function correct() { setCreated(null); setAnalysis(null); setSourceType("text"); setError(""); }

  return <>
    {floating ? <button type="button" onClick={() => begin("voice")} className="fixed bottom-20 right-3 z-50 flex min-h-20 items-center gap-3 rounded-full bg-red-600 px-5 text-white shadow-2xl shadow-red-950/35 ring-4 ring-white/90 transition hover:scale-[1.02] hover:bg-red-700 active:scale-95 dark:ring-slate-950/90 sm:bottom-6 sm:right-6 sm:min-h-20 sm:px-6" aria-label="Dire à IACourtier"><span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/15"><span className="absolute inset-0 animate-ping rounded-full bg-white/15" /><Mic className="relative h-7 w-7" /></span><span className="max-w-28 text-left text-sm font-black uppercase leading-4 tracking-wide">Dire à IACourtier</span></button> : <section id="dire-a-iacourtier" className="scroll-mt-24 rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 via-white to-white p-5 shadow-sm dark:border-red-950 dark:from-red-950/30 dark:via-slate-900 dark:to-slate-900 sm:p-7"><div className="grid items-center gap-5 lg:grid-cols-[1fr_auto]"><div><p className="inline-flex items-center gap-2 text-sm font-bold text-red-700"><Sparkles className="h-5 w-5" />Capture IA</p><h2 className="mt-2 text-2xl font-semibold">Une pression. Tu parles. IACourtier organise.</h2><p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Après un appel ou en déplacement, dicte ce que tu viens d’apprendre et les suivis à faire. La transcription originale reste dans le dossier.</p></div><button type="button" onClick={() => begin("voice")} className="flex min-h-28 w-full items-center justify-center gap-4 rounded-3xl bg-red-600 px-7 text-white shadow-xl shadow-red-900/20 transition hover:bg-red-700 active:scale-[.98] lg:w-72"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15"><Mic className="h-9 w-9" /></span><span className="text-left text-lg font-black uppercase leading-5">Dire à<br />IACourtier</span></button></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{choices.map((choice) => choice.href ? <Link key={choice.type} href={choice.href} className="flex min-h-16 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold hover:border-red-300 dark:border-slate-800 dark:bg-slate-950"><choice.icon className="h-5 w-5 text-red-600" />{choice.label}</Link> : <button key={choice.type} type="button" onClick={() => begin(choice.type)} className="flex min-h-16 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold hover:border-red-300 dark:border-slate-800 dark:bg-slate-950"><choice.icon className="h-5 w-5 text-red-600" />{choice.label}</button>)}</div>{recent.length ? <RecentCaptures captures={recent} /> : null}</section>}

    {open ? <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Capture vocale IA"><div className="max-h-[96vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] sm:p-7"><header className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-red-700">Capture IA · {sourceType === "voice" ? "voix" : "texte"}</p><h2 className="mt-1 text-2xl font-semibold">{created ? "✓ C’est fait" : analysis?.requiresChoice ? "Quelle personne?" : sourceType === "voice" ? "🎙️ Je vous écoute…" : "Qu’est-ce qu’il faut retenir?"}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full border border-slate-200 p-2 dark:border-slate-700"><X className="h-5 w-5" /></button></header>
      {created ? <Success result={created} onCorrect={correct} /> : analysis?.requiresChoice ? <Ambiguity payload={analysis} clientId={clientId} setClientId={setClientId} onCorrect={correct} /> : sourceType === "voice" ? <div className="mt-7"><div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/60 dark:bg-red-950/40 dark:ring-red-950/20"><Mic className="h-14 w-14" /></div><p className="mt-5 min-h-20 rounded-2xl bg-slate-50 p-4 text-center text-base leading-7 text-slate-700 dark:bg-slate-950 dark:text-slate-200">{text || "Parle naturellement : personne, dossier, ce qui a changé et ce qu’il faut faire."}</p><VoiceDictationButton autoStart large className="mt-5" stopLabel="TERMINER" label="RECOMMENCER" onLiveTranscript={setText} onTranscript={(value) => { setText(value); void analyze(value); }} />{busy ? <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-red-700"><Loader2 className="h-4 w-4 animate-spin" />J’analyse, je recherche les doublons et j’organise le CRM…</p> : null}<button type="button" onClick={() => setSourceType("text")} className="mt-4 w-full text-center text-sm font-semibold text-slate-500">Écrire plutôt</button></div> : <div className="mt-6"><textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} autoFocus className="w-full rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950" placeholder="Ex. Je viens de parler à Chantal Beaulieu…" /><button type="button" onClick={() => void analyze()} disabled={busy || !text.trim()} className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}Organiser maintenant</button></div>}
      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {analysis?.requiresChoice && !created ? <button type="button" onClick={() => void confirm()} disabled={busy || !clientId} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}Continuer avec cette fiche</button> : null}
    </div></div> : null}
  </>;
}

function Success({ result, onCorrect }: { result: Processed; onCorrect: () => void }) { return <div className="mt-6"><CheckCircle2 className="h-12 w-12 text-emerald-600" /><h3 className="mt-3 text-2xl font-semibold">{result.clientName}</h3><p className="mt-1 text-sm text-slate-500">{result.caseLabel}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20"><p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Créé / mis à jour</p><ul className="mt-3 space-y-2 text-sm">{result.updated.map((item) => <li key={item}>✓ {item}</li>)}</ul></div><div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm font-bold">Planifié</p><ul className="mt-3 space-y-2 text-sm">{result.tasks.map((task) => <li key={task.title}>☐ {task.title}{task.dueLabel ? ` · ${task.dueLabel}` : ""}</li>)}</ul></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Link href={`/tableau-de-bord/clients/${result.clientId}`} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-semibold text-white dark:bg-white dark:text-slate-950">Ouvrir {result.clientName.split(" ")[0]}<ChevronRight className="h-4 w-4" /></Link><button type="button" onClick={onCorrect} className="min-h-13 rounded-2xl border border-slate-300 px-5 font-semibold dark:border-slate-700">Corriger</button></div></div>; }
function Ambiguity({ payload, clientId, setClientId, onCorrect }: { payload: AnalysisPayload; clientId: string | null; setClientId: (value: string | null) => void; onCorrect: () => void }) { return <div className="mt-6"><p className="text-sm text-slate-600 dark:text-slate-300">J’ai trouvé plusieurs correspondances. Une seule décision suffit; rien n’est créé avant ton choix.</p><div className="mt-4 space-y-2">{payload.potentialDuplicates.map((client) => <label key={client.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${clientId === client.id ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-slate-200 dark:border-slate-800"}`}><input type="radio" name="client-match" checked={clientId === client.id} onChange={() => setClientId(client.id)} /><span><strong>{`${client.first_name || ""} ${client.last_name || ""}`.trim()}</strong><span className="mt-1 block text-xs text-slate-500">{[client.roles?.join(" + "), client.phone, client.email, client.reasons?.join(", ")].filter(Boolean).join(" · ")}</span></span></label>)}</div>{!payload.potentialDuplicates.length ? <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p>Je n’ai pas reconnu clairement la personne.</p><button type="button" onClick={onCorrect} className="mt-3 font-bold underline">Corriger la transcription</button></div> : null}</div>; }
function RecentCaptures({ captures }: { captures: RecentCapture[] }) { return <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800"><h3 className="text-sm font-bold">Captures récentes</h3><div className="mt-3 grid gap-2 lg:grid-cols-2">{captures.slice(0, 4).map((capture) => { const result = capture.analysis?.processing as Processed | undefined; return <Link key={capture.id} href={capture.case_id ? `/tableau-de-bord/dossiers/${capture.case_id}` : "#"} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm hover:border-red-300 dark:border-slate-800 dark:bg-slate-950"><span className="flex items-center justify-between gap-3"><strong>{result?.clientName || "Capture à vérifier"}</strong><span className={capture.status === "confirmed" ? "text-emerald-600" : "text-amber-600"}>{capture.status === "confirmed" ? "Organisée" : "À vérifier"}</span></span><span className="mt-1 block truncate text-xs text-slate-500">{capture.raw_text}</span>{result?.tasks?.length ? <span className="mt-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">{result.tasks.length} action{result.tasks.length > 1 ? "s" : ""} créée{result.tasks.length > 1 ? "s" : ""}</span> : null}</Link>; })}</div></div>; }

