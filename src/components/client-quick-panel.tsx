"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, FilePlus2, Loader2, Mail, MapPin, MoreHorizontal, NotebookPen, Phone, Save, UserRound, X } from "lucide-react";

import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { CrmCallButton } from "@/components/crm-call-button";
import { formatPhone } from "@/lib/crm-phone";

export type QuickClient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mailing_address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  birth_date?: string | null;
  language?: string | null;
  source?: string | null;
  notes?: string | null;
  tags?: string[] | null;
};

type Mode = "profile" | "note" | "task";

export function ClientQuickPanel({ client, caseId = null, caseLabel, returnHref, returnLabel, onUpdated, compact = false }: {
  client: QuickClient;
  caseId?: string | null;
  caseLabel?: string;
  returnHref?: string;
  returnLabel?: string;
  onUpdated?: (client: QuickClient) => void;
  compact?: boolean;
}) {
  const { authenticatedFetch } = useDashboardAuth();
  const [current, setCurrent] = useState(client);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("profile");
  const [focusField, setFocusField] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [task, setTask] = useState("");
  const [form, setForm] = useState(() => clientForm(client));

  useEffect(() => { setCurrent(client); setForm(clientForm(client)); }, [client]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const name = clientName(current);
  const fullHref = useMemo(() => {
    const query = new URLSearchParams();
    if (returnHref) query.set("from", returnHref);
    if (returnLabel || caseLabel) query.set("fromLabel", returnLabel || caseLabel || "dossier");
    const suffix = query.toString();
    return `/tableau-de-bord/clients/${current.id}${suffix ? `?${suffix}` : ""}`;
  }, [caseLabel, current.id, returnHref, returnLabel]);

  function show(nextMode: Mode, field = "") {
    setMode(nextMode);
    setFocusField(field);
    setError("");
    setNotice("");
    setOpen(true);
  }

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await authenticatedFetch(`/api/clients/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, caseId }) });
      const result = await response.json() as { error?: string; client?: QuickClient };
      if (!response.ok) throw new Error(result.error || "La modification n’a pas pu être enregistrée.");
      if (result.client) {
        setCurrent(result.client);
        setForm(clientForm(result.client));
        onUpdated?.(result.client);
      }
      setNotice(mode === "profile" ? "La fiche client centrale est enregistrée." : mode === "note" ? "La note est enregistrée dans la fiche client." : "La tâche est ajoutée au dossier.");
      if (mode === "note") setNote("");
      if (mode === "task") setTask("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La modification n’a pas pu être enregistrée.");
    } finally { setBusy(false); }
  }

  const documentHref = caseId ? `/tableau-de-bord/dossiers/${caseId}?add=document#ajouter-source` : "/tableau-de-bord/importer";
  return <>
    <article className={compact ? "min-w-0" : "rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => show("profile")} className="min-w-0 text-left font-semibold text-slate-950 underline-offset-4 hover:text-teal-700 hover:underline dark:text-white" aria-label={`Ouvrir les actions de ${name}`}>{name}</button>
        <details className="relative shrink-0"><summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-500 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900" aria-label={`Actions rapides pour ${name}`}><MoreHorizontal className="h-5 w-5" /></summary><div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <Link href={fullHref} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ExternalLink className="h-4 w-4" />Ouvrir la fiche</Link>
          <MenuButton icon={<UserRound className="h-4 w-4" />} label="Modifier" onClick={() => show("profile")} />
          <MenuButton icon={<Phone className="h-4 w-4" />} label="Ajouter un téléphone" onClick={() => show("profile", "phone")} />
          <MenuButton icon={<Mail className="h-4 w-4" />} label="Ajouter un courriel" onClick={() => show("profile", "email")} />
          <MenuButton icon={<MapPin className="h-4 w-4" />} label="Ajouter une adresse" onClick={() => show("profile", "mailingAddress")} />
          <MenuButton icon={<NotebookPen className="h-4 w-4" />} label="Ajouter une note" onClick={() => show("note")} />
          {caseId ? <MenuButton icon={<Save className="h-4 w-4" />} label="Ajouter une tâche" onClick={() => show("task")} /> : null}
          <Link href={documentHref} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><FilePlus2 className="h-4 w-4" />Ajouter un document</Link>
          {current.email ? <a href={`mailto:${current.email}`} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Mail className="h-4 w-4" />Envoyer un courriel</a> : null}
        </div></details>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
        {current.email ? <a href={`mailto:${current.email}`} className="hover:text-teal-700">{current.email}</a> : <MissingButton label="Courriel à compléter" onClick={() => show("profile", "email")} />}
        {current.phone ? <span>{formatPhone(current.phone)}</span> : <MissingButton label="Téléphone à compléter" onClick={() => show("profile", "phone")} />}
      </div>
      <div className="mt-3"><CrmCallButton compact clientId={current.id} caseId={caseId} phone={current.phone} clientName={name} /></div>
      {current.mailing_address ? <button type="button" onClick={() => show("profile", "mailingAddress")} className="mt-2 text-left text-xs text-slate-500 hover:text-teal-700">Adresse personnelle : {[current.mailing_address, current.city, current.postal_code].filter(Boolean).join(", ")}</button> : <div className="mt-2"><MissingButton label="Adresse personnelle à compléter" onClick={() => show("profile", "mailingAddress")} /></div>}
    </article>

    {open ? <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Fiche rapide de ${name}`}>
      <button type="button" className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="Fermer" />
      <aside className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl dark:bg-slate-950 sm:max-w-md">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800"><div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">Fiche client rapide</p><h2 className="mt-1 text-xl font-semibold">{name}</h2>{caseLabel ? <p className="mt-1 text-xs text-slate-500">Depuis : {caseLabel}</p> : null}</div><button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 p-2 dark:border-slate-700" aria-label="Fermer"><X className="h-5 w-5" /></button></header>
        <div className="flex gap-2 border-b border-slate-200 px-5 py-3 text-sm dark:border-slate-800"><Tab active={mode === "profile"} onClick={() => setMode("profile")}>Modifier</Tab><Tab active={mode === "note"} onClick={() => setMode("note")}>Note</Tab>{caseId ? <Tab active={mode === "task"} onClick={() => setMode("task")}>Tâche</Tab> : null}</div>
        <div className="flex-1 overflow-y-auto p-5">
          {mode === "profile" ? <form id={`client-profile-${current.id}`} className="space-y-4" onSubmit={(event) => { event.preventDefault(); void send({ action: "profile", values: { ...form, tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean) } }); }}>
            <div className="grid grid-cols-2 gap-3"><Field label="Prénom" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} /><Field label="Nom" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} /></div>
            <Field type="email" label="Courriel" value={form.email} onChange={(value) => setForm({ ...form, email: value })} autoFocus={focusField === "email"} />
            <Field type="tel" label="Téléphone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} autoFocus={focusField === "phone"} />
            <Field label="Adresse personnelle ou postale" value={form.mailingAddress} onChange={(value) => setForm({ ...form, mailingAddress: value })} autoFocus={focusField === "mailingAddress"} hint="Cette adresse appartient au client et ne modifie jamais l’adresse de la propriété." />
            <div className="grid grid-cols-2 gap-3"><Field label="Ville" value={form.city} onChange={(value) => setForm({ ...form, city: value })} /><Field label="Code postal" value={form.postalCode} onChange={(value) => setForm({ ...form, postalCode: value })} /></div>
            <div className="grid grid-cols-2 gap-3"><Field type="date" label="Date de naissance" value={form.birthDate} onChange={(value) => setForm({ ...form, birthDate: value })} /><Field label="Langue" value={form.language} onChange={(value) => setForm({ ...form, language: value })} /></div>
            <Field label="Source" value={form.source} onChange={(value) => setForm({ ...form, source: value })} />
            <Field label="Tags (séparés par des virgules)" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} />
          </form> : mode === "note" ? <form id={`client-note-${current.id}`} onSubmit={(event) => { event.preventDefault(); void send({ action: "note", body: note }); }}><label className="text-sm font-semibold" htmlFor={`note-${current.id}`}>Nouvelle note</label><textarea id={`note-${current.id}`} value={note} onChange={(event) => setNote(event.target.value)} autoFocus rows={8} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Conversation, préférence, suivi…" /></form> : <form id={`client-task-${current.id}`} onSubmit={(event) => { event.preventDefault(); void send({ action: "task", title: task }); }}><Field label="Tâche de suivi" value={task} onChange={setTask} autoFocus /><p className="mt-2 text-xs text-slate-500">La tâche sera reliée au dossier courant et à cette personne uniquement.</p></form>}
          {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
          {notice ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
        </div>
        <footer className="border-t border-slate-200 p-5 dark:border-slate-800"><div className="flex gap-3"><button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"><ArrowLeft className="h-4 w-4" />Retour</button><button type="submit" form={`${mode === "profile" ? "client-profile" : mode === "note" ? "client-note" : "client-task"}-${current.id}`} disabled={busy} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{mode === "profile" ? "Enregistrer" : "Ajouter"}</button></div><Link href={fullHref} className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-teal-700">Ouvrir la fiche client 360 <ExternalLink className="h-4 w-4" /></Link></footer>
      </aside>
    </div> : null}
  </>;
}

function clientForm(client: QuickClient) { return { firstName: client.first_name || "", lastName: client.last_name || "", email: client.email || "", phone: client.phone || "", mailingAddress: client.mailing_address || "", city: client.city || "", postalCode: client.postal_code || "", birthDate: client.birth_date || "", language: client.language || "", source: client.source || "", tags: (client.tags || []).join(", ") }; }
function clientName(client: QuickClient) { return `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Personne à identifier"; }
function MissingButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="font-semibold text-amber-700 underline decoration-dotted underline-offset-4 hover:text-teal-700 dark:text-amber-300">{label}</button>; }
function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">{icon}{label}</button>; }
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 font-semibold ${active ? "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{children}</button>; }
function Field({ label, value, onChange, type = "text", autoFocus = false, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoFocus?: boolean; hint?: string }) { return <label className="block text-sm font-semibold"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900" />{hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}</label>; }

