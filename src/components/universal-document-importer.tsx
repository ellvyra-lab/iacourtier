"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, FileSearch, FileText, Images, Loader2, Search, Sparkles, UploadCloud, UserRound, X } from "lucide-react";

import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import type { PersonDecision, UniversalAnalysis, UniversalPerson, UniversalProjectType } from "@/lib/universal-import";

type ConfirmResult = {
  ok: boolean;
  listingId: string | null;
  buyerCaseId: string | null;
  primaryHref: string;
  createdContacts: string[];
  reusedContacts: string[];
  uploadedFiles: number;
  summary: string;
};

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp";

export function UniversalDocumentImporter() {
  const { authenticatedFetch } = useDashboardAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const documentsRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<UniversalAnalysis | null>(null);
  const [decisions, setDecisions] = useState<Record<string, PersonDecision>>({});
  const [status, setStatus] = useState<"idle" | "analyzing" | "confirming" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConfirmResult | null>(null);

  const unresolvedDuplicates = useMemo(() => (analysis?.duplicates || []).filter((duplicate) => !decisions[duplicate.personId]), [analysis, decisions]);
  const canConfirm = Boolean(analysis && analysis.projectType !== "unknown" && analysis.people.length && !unresolvedDuplicates.length && status === "idle");

  function receiveFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files || []);
    if (!incoming.length) return;
    setFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (!next.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) next.push(file);
      }
      return next.slice(0, 12);
    });
    setAnalysis(null);
    setResult(null);
    setDecisions({});
    setError("");
    event.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setAnalysis(null);
    setDecisions({});
    setResult(null);
  }

  async function analyze() {
    if (!files.length) return;
    setStatus("analyzing");
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      const response = await authenticatedFetch("/api/universal-import/analyze", { method: "POST", body });
      const payload = await response.json() as { analysis?: UniversalAnalysis; error?: string; detail?: string };
      if (!response.ok || !payload.analysis) throw new Error([payload.error, payload.detail].filter(Boolean).join(" — ") || "L’analyse a échoué.");
      setAnalysis(payload.analysis);
      const automatic: Record<string, PersonDecision> = {};
      setDecisions(automatic);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "L’analyse a échoué.");
    } finally {
      setStatus("idle");
    }
  }

  async function confirm() {
    if (!analysis || !canConfirm) return;
    setStatus("confirming");
    setError("");
    try {
      const body = new FormData();
      body.append("analysis", JSON.stringify(analysis));
      body.append("decisions", JSON.stringify(Object.values(decisions)));
      files.forEach((file) => body.append("files", file));
      const response = await authenticatedFetch("/api/universal-import/confirm", { method: "POST", body });
      const payload = await response.json() as ConfirmResult & { error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "La création du dossier a échoué.");
      setResult(payload);
      setStatus("done");
    } catch (confirmationError) {
      setError(confirmationError instanceof Error ? confirmationError.message : "La création du dossier a échoué.");
      setStatus("idle");
    }
  }

  function updatePerson(id: string, patch: Partial<UniversalPerson>) {
    setAnalysis((current) => current ? { ...current, people: current.people.map((person) => person.id === id ? { ...person, ...patch } : person) } : current);
  }

  function addPerson() {
    setAnalysis((current) => current ? {
      ...current,
      people: [...current.people, {
        id: `person-${current.people.length + 1}`,
        firstName: "", lastName: "", email: "", phone: "", mailingAddress: "",
        roles: current.projectType === "buyer" ? ["buyer"] : ["seller"],
        sourceName: "Ajout manuel après analyse", confidence: null,
      }],
    } : current);
  }

  if (result) {
    return <section className="mx-auto max-w-3xl rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20 sm:p-8" role="status">
      <CheckCircle2 className="h-10 w-10 text-emerald-700" />
      <h1 className="mt-4 text-2xl font-semibold">Import confirmé et enregistré</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{result.summary}</p>
      <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 text-sm dark:bg-slate-950 sm:grid-cols-3">
        <Stat label="Fichiers" value={String(result.uploadedFiles)} />
        <Stat label="Clients créés" value={String(result.createdContacts.length)} />
        <Stat label="Clients réutilisés" value={String(result.reusedContacts.length)} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3"><Link href={result.primaryHref} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-5 font-semibold text-white">Ouvrir le dossier <ArrowRight className="h-4 w-4" /></Link><button type="button" onClick={() => { setFiles([]); setAnalysis(null); setResult(null); setStatus("idle"); }} className="min-h-12 rounded-xl border border-emerald-300 px-5 font-semibold">Faire un autre import</button></div>
    </section>;
  }

  return <div className="mx-auto max-w-6xl space-y-6 overflow-x-hidden">
    <header className="space-y-2"><p className="text-sm font-semibold text-teal-700">Analyse intelligente universelle</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Importer un document ou une conversation</h1><p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">PDF, photo de document ou captures d’écran : IACourtier identifie les personnes, recherche les doublons et prépare le bon dossier. Rien n’est créé avant ta confirmation.</p></header>

    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <SourceButton icon={Camera} label="Prendre une photo" detail="Caméra du téléphone" onClick={() => cameraRef.current?.click()} />
        <SourceButton icon={Images} label="Choisir des photos" detail="Plusieurs images" onClick={() => photosRef.current?.click()} />
        <SourceButton icon={UploadCloud} label="Choisir un fichier" detail="PDF ou image" onClick={() => documentsRef.current?.click()} />
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={receiveFiles} className="sr-only" />
      <input ref={photosRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp,.heic,.heif" multiple onChange={receiveFiles} className="sr-only" />
      <input ref={documentsRef} type="file" accept={ACCEPTED} multiple onChange={receiveFiles} className="sr-only" />
      <p className="mt-4 text-xs text-slate-500">Formats : PDF, JPG, JPEG, PNG, HEIC, HEIF et WEBP · jusqu’à 12 fichiers de 15 Mo.</p>

      {files.length ? <div className="mt-5 space-y-2"><p className="text-sm font-semibold">{files.length} fichier{files.length > 1 ? "s" : ""} prêt{files.length > 1 ? "s" : ""}</p>{files.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><FileText className="h-4 w-4 shrink-0 text-teal-700" /><span className="min-w-0 flex-1 truncate text-sm">{file.name}</span><span className="shrink-0 text-xs text-slate-500">{formatBytes(file.size)}</span><button type="button" onClick={() => removeFile(index)} aria-label={`Retirer ${file.name}`} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>)}</div> : null}

      <button type="button" disabled={!files.length || status !== "idle"} onClick={() => void analyze()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{status === "analyzing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSearch className="h-5 w-5" />}{status === "analyzing" ? "Analyse des sources…" : analysis ? "Relancer l’analyse" : "Analyser sans créer"}</button>
    </section>

    {status === "analyzing" ? <section className="rounded-3xl border border-teal-200 bg-teal-50 p-6 dark:border-teal-900 dark:bg-teal-950/20" role="status"><div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-teal-700" /><div><p className="font-semibold">Lecture du contenu et recherche des doublons…</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Les PDF numérisés et les captures sont lus visuellement. Aucun dossier n’est créé pendant cette étape.</p></div></div></section> : null}
    {error ? <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100" role="alert"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div> : null}

    {analysis ? <>
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 dark:border-teal-900 dark:from-teal-950/30 dark:to-slate-900 sm:p-6"><div className="flex items-center gap-2 text-sm font-semibold text-teal-800 dark:text-teal-200"><Sparkles className="h-5 w-5" />Résumé du Coach IA</div><p className="mt-3 leading-7">{analysis.coachSummary}</p></section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Projet et étape" icon={Search}>
          <FieldLabel label="Type de projet"><select value={analysis.projectType} onChange={(event) => setAnalysis({ ...analysis, projectType: event.target.value as UniversalProjectType })} className={inputClass}><option value="unknown">À confirmer</option><option value="seller">Vendeur</option><option value="buyer">Acheteur</option><option value="buy_sell">Achat + vente</option></select></FieldLabel>
          <div className="grid gap-3 sm:grid-cols-2"><ReadOnly label="Étape vendeur" value={analysis.sellerStage || "Sans objet"} /><ReadOnly label="Étape acheteur" value={analysis.buyerStage || "Sans objet"} /></div>
          <ReadOnly label="Pourquoi cette étape" value={analysis.stageRationale} />
          <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Intentions détectées</p><div className="mt-2 flex flex-wrap gap-2">{analysis.intentions.length ? analysis.intentions.map((intent) => <span key={intent} className="rounded-full bg-teal-100 px-3 py-1 text-xs text-teal-900 dark:bg-teal-950 dark:text-teal-100">{intent}</span>) : <span className="text-sm text-slate-500">À confirmer</span>}</div></div>
        </Panel>
        <Panel title="Sources classées" icon={FileText}>{analysis.sources.map((source) => <div key={source.name} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="truncate text-sm font-semibold">{source.name}</p><p className="mt-1 text-xs text-slate-500">{source.type} · {source.sourceType}{source.confidence !== null ? ` · ${Math.round(source.confidence * 100)} %` : ""}</p></div>)}</Panel>
      </section>

      <Panel title="Personnes identifiées" icon={UserRound}>
        {analysis.people.length ? <div className="space-y-5">{analysis.people.map((person) => <PersonEditor key={person.id} person={person} onChange={(patch) => updatePerson(person.id, patch)} />)}</div> : <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Aucune personne certaine. Corrige les sources ou relance avec des images plus lisibles.</div>}
        <button type="button" onClick={addPerson} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700">Ajouter une personne manuellement</button>
      </Panel>

      {(analysis.duplicates || []).length ? <Panel title="Doublons possibles — décision obligatoire" icon={Search}>{analysis.duplicates!.map((duplicate) => {
        const person = analysis.people.find((item) => item.id === duplicate.personId);
        return <div key={duplicate.personId} className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"><p className="font-semibold">{person ? `${person.firstName} ${person.lastName}`.trim() : "Personne"}</p>{duplicate.matches.map((match) => <label key={match.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-950"><input type="radio" name={`duplicate-${duplicate.personId}`} checked={decisions[duplicate.personId]?.action === "use" && decisions[duplicate.personId]?.existingContactId === match.id} onChange={() => setDecisions((current) => ({ ...current, [duplicate.personId]: { personId: duplicate.personId, action: "use", existingContactId: match.id } }))} className="mt-1" /><span className="min-w-0"><span className="block font-semibold">Utiliser {match.name}</span><span className="block text-xs text-slate-500">Correspondance : {match.matchedOn.join(", ")} · {match.email || match.phone || "coordonnées non renseignées"}</span><Link href={`/tableau-de-bord/clients?client=${match.id}`} target="_blank" className="mt-1 inline-flex text-xs font-semibold text-teal-700 underline">Voir cette fiche</Link></span></label>)}<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-950"><input type="radio" name={`duplicate-${duplicate.personId}`} checked={decisions[duplicate.personId]?.action === "create"} onChange={() => setDecisions((current) => ({ ...current, [duplicate.personId]: { personId: duplicate.personId, action: "create" } }))} className="mt-1" /><span><span className="block font-semibold">Créer quand même une nouvelle fiche</span><span className="block text-xs text-slate-500">Confirmation explicite requise pour autoriser ce doublon.</span></span></label></div>;
      })}</Panel> : <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100"><CheckCircle2 className="h-5 w-5" />Aucun doublon client détecté selon le nom, le courriel ou le téléphone.</div>}

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Propriété" icon={FileSearch}>
          {analysis.propertyDuplicate ? <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/20">Propriété existante reconnue : <strong>{analysis.propertyDuplicate.address}, {analysis.propertyDuplicate.city}</strong>. Elle sera réutilisée.</div> : null}
          <div className="grid gap-3 sm:grid-cols-2"><Editable label="Adresse" value={analysis.property.address} onChange={(address) => setAnalysis({ ...analysis, property: { ...analysis.property, address } })} wide /><Editable label="Ville" value={analysis.property.city} onChange={(city) => setAnalysis({ ...analysis, property: { ...analysis.property, city } })} /><Editable label="Code postal" value={analysis.property.postalCode} onChange={(postalCode) => setAnalysis({ ...analysis, property: { ...analysis.property, postalCode } })} /><Editable label="Type" value={analysis.property.propertyType} onChange={(propertyType) => setAnalysis({ ...analysis, property: { ...analysis.property, propertyType } })} /><Editable label="Lot" value={analysis.property.lotNumber} onChange={(lotNumber) => setAnalysis({ ...analysis, property: { ...analysis.property, lotNumber } })} /></div>
        </Panel>
        <Panel title="Critères acheteur" icon={Search}>
          <div className="grid gap-3 sm:grid-cols-2"><Editable label="Budget" value={analysis.buyerCriteria.budget} onChange={(budget) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, budget } })} /><Editable label="Préapprobation" value={analysis.buyerCriteria.preapprovalStatus} onChange={(preapprovalStatus) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, preapprovalStatus } })} /><Editable label="Secteurs" value={analysis.buyerCriteria.sectors.join(", ")} onChange={(value) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, sectors: value.split(",").map((item) => item.trim()).filter(Boolean) } })} wide /><Editable label="Type recherché" value={analysis.buyerCriteria.propertyType} onChange={(propertyType) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, propertyType } })} /><Editable label="Chambres" value={analysis.buyerCriteria.bedrooms} onChange={(bedrooms) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, bedrooms } })} /><Editable label="Échéancier" value={analysis.buyerCriteria.timeline} onChange={(timeline) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, timeline } })} wide /></div>
        </Panel>
      </section>

      <Panel title="Provenance et confiance" icon={FileSearch}>
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">{analysis.facts.map((fact, index) => <div key={`${fact.field}-${fact.sourceName}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800 sm:grid-cols-[1fr_1fr_auto]"><span><span className="block font-semibold">{fact.label}</span><span className="block break-words text-slate-600 dark:text-slate-300">{fact.value}</span></span><span className="text-xs text-slate-500"><span className="block">Source : {fact.sourceName}</span><span className="block">Type : {fact.sourceType}</span>{fact.note ? <span className="block">{fact.note}</span> : null}</span><span className={`h-fit rounded-full px-2 py-1 text-xs font-semibold ${fact.status === "confirmed" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{fact.status === "confirmed" ? "Confirmé" : "À confirmer"}{fact.confidence !== null ? ` · ${Math.round(fact.confidence * 100)} %` : ""}</span></div>)}</div>
      </Panel>

      {analysis.ambiguities.length ? <Panel title="Ambiguïtés à valider" icon={AlertTriangle}>{analysis.ambiguities.map((ambiguity) => <p key={ambiguity} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{ambiguity}</p>)}</Panel> : null}

      <section className="sticky bottom-3 z-10 rounded-2xl border border-slate-300 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Confirmation finale</p><p className="text-xs text-slate-500">Après ce clic seulement : fiches clients, propriété, dossier, étape, tâches, automatisations et documents seront reliés.</p>{unresolvedDuplicates.length ? <p className="mt-1 text-xs font-semibold text-amber-700">Choisis quoi faire pour {unresolvedDuplicates.length} doublon{unresolvedDuplicates.length > 1 ? "s" : ""}.</p> : null}</div><button type="button" disabled={!canConfirm} onClick={() => void confirm()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950">{status === "confirming" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{status === "confirming" ? "Enregistrement…" : "Confirmer et créer/relier"}</button></div></section>
    </> : null}
  </div>;
}

const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950";

function SourceButton({ icon: Icon, label, detail, onClick }: { icon: typeof Camera; label: string; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-teal-400 hover:bg-teal-50 dark:border-slate-800 dark:hover:border-teal-700 dark:hover:bg-teal-950/20"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200"><Icon className="h-5 w-5" /></span><span><span className="block font-semibold">{label}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></span></button>; }
function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Search; children: React.ReactNode }) { return <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-teal-700" />{title}</h2>{children}</section>; }
function PersonEditor({ person, onChange }: { person: UniversalPerson; onChange: (patch: Partial<UniversalPerson>) => void }) { const roleValue = person.roles.includes("seller") && person.roles.includes("buyer") ? "both" : person.roles.includes("buyer") ? "buyer" : "seller"; return <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Editable label="Prénom" value={person.firstName} onChange={(firstName) => onChange({ firstName })} /><Editable label="Nom" value={person.lastName} onChange={(lastName) => onChange({ lastName })} /><Editable label="Courriel" value={person.email} onChange={(email) => onChange({ email })} /><Editable label="Téléphone" value={person.phone} onChange={(phone) => onChange({ phone })} /><Editable label="Adresse postale" value={person.mailingAddress} onChange={(mailingAddress) => onChange({ mailingAddress })} wide /><FieldLabel label="Rôle"><select value={roleValue} onChange={(event) => onChange({ roles: event.target.value === "both" ? ["seller", "buyer"] : [event.target.value as "seller" | "buyer"] })} className={inputClass}><option value="seller">Vendeur</option><option value="buyer">Acheteur</option><option value="both">Acheteur + vendeur</option></select></FieldLabel></div><p className="mt-3 text-xs text-slate-500">Source : {person.sourceName || "à confirmer"}{person.confidence !== null ? ` · confiance ${Math.round(person.confidence * 100)} %` : ""}</p></div>; }
function Editable({ label, value, onChange, wide }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) { return <FieldLabel label={label} wide={wide}><input value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} /></FieldLabel>; }
function FieldLabel({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>{children}</label>; }
function ReadOnly({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-medium">{value.replace(/_/g, " ")}</p></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>; }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`; }
