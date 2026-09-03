"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Phone, PhoneOff, X } from "lucide-react";

import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { VoiceDictationButton } from "@/components/voice-dictation-button";
import { CALL_OUTCOMES, formatPhone, normalizePhone, type CallOutcome } from "@/lib/crm-phone";

export function CrmCallButton({ clientId, caseId = null, propertyId = null, taskId = null, phone, clientName, compact = false, onCompleted }: {
  clientId: string; caseId?: string | null; propertyId?: string | null; taskId?: string | null; phone?: string | null; clientName: string; compact?: boolean; onCompleted?: () => void;
}) {
  const { authenticatedFetch } = useDashboardAuth();
  const [callId, setCallId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<{ outcome: CallOutcome | ""; note: string; objection: string; interestLevel: string; nextContactAt: string }>({ outcome: "", note: "", objection: "", interestLevel: "unknown", nextContactAt: "" });
  const normalized = normalizePhone(phone);

  async function startCall() {
    if (!normalized) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await authenticatedFetch("/api/crm/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, caseId, propertyId, taskId }) });
      const payload = await response.json() as { error?: string; callId?: string; href?: string };
      if (!response.ok || !payload.callId || !payload.href) throw new Error(payload.error || "L’appel n’a pas pu démarrer.");
      setCallId(payload.callId);
      window.location.href = payload.href;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "L’appel n’a pas pu démarrer."); }
    finally { setBusy(false); }
  }

  async function saveResult() {
    if (!callId || !form.outcome) return;
    setBusy(true); setError("");
    try {
      const response = await authenticatedFetch(`/api/crm/calls/${callId}/result`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, nextContactAt: form.nextContactAt || null }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Le résultat n’a pas pu être enregistré.");
      setSaved(true); setCallId(null); onCompleted?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Le résultat n’a pas pu être enregistré."); }
    finally { setBusy(false); }
  }

  if (!normalized) return <div className="inline-flex flex-col items-start gap-1"><button type="button" disabled className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-400 dark:border-slate-700"><PhoneOff className="h-4 w-4" />Téléphone manquant</button><Link href={`/tableau-de-bord/clients/${clientId}`} className="text-xs font-semibold text-amber-700">Ajouter le numéro à la fiche</Link></div>;

  return <>
    <div className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void startCall()} disabled={busy} aria-label={`Appeler ${clientName} au ${formatPhone(phone)}`} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 ${compact ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm"}`}>{busy && !open ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}Appeler{compact ? "" : ` · ${formatPhone(phone)}`}</button>
      {callId ? <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-xl border border-emerald-600 px-3 text-sm font-semibold text-emerald-700">Résultat de l’appel</button> : null}
      {saved ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />Enregistré</span> : null}
    </div>
    {error && !open ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    {open ? <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Résultat de l’appel"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-3xl sm:p-6"><header className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">Appel terminé</p><h2 className="mt-1 text-xl font-semibold">Résultat — {clientName}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full border border-slate-200 p-2 dark:border-slate-700"><X className="h-5 w-5" /></button></header><div className="mt-5 space-y-4"><label className="block text-sm font-semibold">Résultat<select value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value as CallOutcome })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"><option value="">Choisir…</option>{CALL_OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block text-sm font-semibold">Note<textarea rows={5} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950" placeholder="Ce que le client a dit, décision, contexte…" /></label><VoiceDictationButton onTranscript={(text) => setForm((current) => ({ ...current, note: [current.note, text].filter(Boolean).join(" ") }))} label="Dicter ma note" /><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Intérêt<select value={form.interestLevel} onChange={(event) => setForm({ ...form, interestLevel: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"><option value="unknown">À déterminer</option><option value="hot">Chaud</option><option value="warm">Tiède</option><option value="cold">Froid</option></select></label><label className="text-sm font-semibold">Prochain suivi<input type="datetime-local" value={form.nextContactAt} onChange={(event) => setForm({ ...form, nextContactAt: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" /></label></div><label className="block text-sm font-semibold">Objection ou frein<input value={form.objection} onChange={(event) => setForm({ ...form, objection: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>{error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}<button type="button" onClick={() => void saveResult()} disabled={busy || !form.outcome} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Enregistrer le résultat</button></div></div></div> : null}
  </>;
}

