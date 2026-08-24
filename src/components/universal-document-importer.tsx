"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, FileSearch, FileText, Images, Loader2, Search, Sparkles, UploadCloud, UserRound, X } from "lucide-react";

import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import type { MergeDecision, MergeProposal, PersonDecision, UniversalAnalysis, UniversalPerson, UniversalProjectType } from "@/lib/universal-import";

type ConfirmResult = {
  ok: boolean;
  listingId: string | null;
  buyerCaseId: string | null;
  primaryHref: string;
  createdContacts: string[];
  reusedContacts: string[];
  uploadedFiles: number;
  partnersLinked: number;
  summary: string;
  merge?: { added: number; confirmed: number; conflicts: number; resolved: number; progress: number };
};

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp";

export function UniversalDocumentImporter({ caseId, caseTitle }: { caseId?: string; caseTitle?: string }) {
  const { authenticatedFetch } = useDashboardAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const documentsRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<UniversalAnalysis | null>(null);
  const [decisions, setDecisions] = useState<Record<string, PersonDecision>>({});
  const [mergeDecisions, setMergeDecisions] = useState<Record<string, MergeDecision>>({});
  const [status, setStatus] = useState<"idle" | "analyzing" | "confirming" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConfirmResult | null>(null);

  const unresolvedDuplicates = useMemo(() => (analysis?.duplicates || []).filter((duplicate) => !decisions[duplicate.personId]), [analysis, decisions]);
  const unresolvedAssignments = useMemo(() => caseId && analysis?.existingCase
    ? analysis.people.filter((person) => !decisions[person.id]) : [], [analysis, caseId, decisions]);
  const unresolvedMergeConflicts = useMemo(() => (analysis?.mergePreview?.proposals || [])
    .filter((proposal) => proposal.status === "conflict" && !mergeDecisions[proposal.id]), [analysis, mergeDecisions]);
  const missingInformation = useMemo(() => analysis ? findMissingInformation(analysis) : [], [analysis]);
  const canConfirm = Boolean(analysis && analysis.projectType !== "unknown" && analysis.people.length && !unresolvedDuplicates.length && !unresolvedAssignments.length && !unresolvedMergeConflicts.length && status === "idle");

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
    setMergeDecisions({});
    setError("");
    event.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setAnalysis(null);
    setDecisions({});
    setMergeDecisions({});
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
      if (caseId) body.append("caseId", caseId);
      const response = await authenticatedFetch("/api/universal-import/analyze", { method: "POST", body });
      const payload = await response.json() as { analysis?: UniversalAnalysis; error?: string; detail?: string };
      if (!response.ok || !payload.analysis) throw new Error([payload.error, payload.detail].filter(Boolean).join(" — ") || "L’analyse a échoué.");
      setAnalysis(payload.analysis);
      const automatic: Record<string, PersonDecision> = {};
      for (const duplicate of payload.analysis.duplicates || []) {
        if (duplicate.matches.length === 1) automatic[duplicate.personId] = { personId: duplicate.personId, action: "use", existingContactId: duplicate.matches[0].id };
      }
      setDecisions(automatic);
      setMergeDecisions({});
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
      body.append("mergeDecisions", JSON.stringify(Object.values(mergeDecisions)));
      if (caseId) body.append("caseId", caseId);
      files.forEach((file) => body.append("files", file));
      const response = await authenticatedFetch("/api/universal-import/confirm", { method: "POST", body });
      const payload = await response.json() as ConfirmResult & { error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || (caseId ? "L’enrichissement du dossier a échoué." : "La création du dossier a échoué."));
      setResult(payload);
      setStatus("done");
    } catch (confirmationError) {
      setError(confirmationError instanceof Error ? confirmationError.message : (caseId ? "L’enrichissement du dossier a échoué." : "La création du dossier a échoué."));
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

  function choosePerson(personId: string, action: PersonDecision["action"], existingContactId?: string) {
    setDecisions((current) => ({ ...current, [personId]: { personId, action, existingContactId } }));
    setAnalysis((current) => {
      if (!current?.mergePreview) return current;
      const client = current.existingCase?.clients.find((item) => item.id === existingContactId);
      const currentByField: Record<string, string> = client ? {
        firstName: client.firstName, lastName: client.lastName, email: client.email,
        phone: client.phone, mailingAddress: client.mailingAddress, birthDate: client.birthDate || "",
        dateOfBirth: client.birthDate || "", language: client.language || "", communicationPreference: client.communicationPreference || "",
      } : {};
      const proposals = current.mergePreview.proposals.map((proposal) => {
        if (proposal.personId !== personId) return proposal;
        const currentValue = action === "create" ? "" : currentByField[proposal.field] || "";
        const status: MergeProposal["status"] = !currentValue ? "new" : equivalentPreview(proposal.field, currentValue, proposal.incomingValue) ? "same" : "conflict";
        return { ...proposal, entityId: existingContactId || null, currentValue, status, reason: status === "new" ? "Cette donnée complète un champ vide." : status === "same" ? "La nouvelle source confirme la valeur déjà enregistrée." : "La valeur diffère de la fiche actuelle; aucun remplacement automatique n’est permis." };
      });
      return { ...current, mergePreview: summarizePreview(current.mergePreview, proposals) };
    });
    setMergeDecisions((current) => {
      const next = { ...current };
      analysis?.mergePreview?.proposals.filter((proposal) => proposal.personId === personId).forEach((proposal) => { delete next[proposal.id]; });
      return next;
    });
  }

  if (result) {
    return <section className="mx-auto max-w-3xl rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20 sm:p-8" role="status">
      <CheckCircle2 className="h-10 w-10 text-emerald-700" />
      <h1 className="mt-4 text-2xl font-semibold">{caseId ? "Dossier enrichi et enregistré" : "Import confirmé et enregistré"}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{result.summary}</p>
      <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 text-sm dark:bg-slate-950 sm:grid-cols-3">
        <Stat label="Fichiers" value={String(result.uploadedFiles)} />
        <Stat label="Clients créés" value={String(result.createdContacts.length)} />
        <Stat label="Clients réutilisés" value={String(result.reusedContacts.length)} />
      </div>
      {result.merge ? <p className="mt-4 rounded-xl bg-white p-3 text-sm dark:bg-slate-950">{result.merge.added} ajout(s), {result.merge.confirmed} confirmation(s), {result.merge.conflicts} conflit(s) traité(s) · dossier prêt à {result.merge.progress} %.</p> : null}
      <div className="mt-6 flex flex-wrap gap-3"><Link href={result.primaryHref} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-5 font-semibold text-white">Ouvrir le dossier <ArrowRight className="h-4 w-4" /></Link><button type="button" onClick={() => { setFiles([]); setAnalysis(null); setResult(null); setDecisions({}); setMergeDecisions({}); setStatus("idle"); }} className="min-h-12 rounded-xl border border-emerald-300 px-5 font-semibold">Ajouter une autre source</button></div>
    </section>;
  }

  return <div className="mx-auto max-w-6xl space-y-6 overflow-x-hidden">
    <header className="space-y-2"><p className="text-sm font-semibold text-teal-700">Analyse intelligente universelle</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{caseId ? "Ajouter des informations au dossier" : "Importer un document ou une conversation"}</h1><p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{caseId ? `Chaque source enrichit ${caseTitle ? `« ${caseTitle} »` : "ce dossier"}. IACourtier compare les données et ne remplace jamais une contradiction sans ta décision.` : "PDF, photo de document ou captures d’écran : IACourtier identifie les personnes, recherche les doublons et prépare le bon dossier. Rien n’est créé avant ta confirmation."}</p></header>

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
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 dark:border-teal-900 dark:from-teal-950/30 dark:to-slate-900 sm:p-6"><div className="flex items-center gap-2 text-sm font-semibold text-teal-800 dark:text-teal-200"><Sparkles className="h-5 w-5" />Analyse terminée</div><h2 className="mt-3 text-2xl font-semibold">Voici ce que j’ai compris</h2><p className="mt-3 leading-7">{analysis.coachSummary}</p></section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Projet et étape" icon={Search}>
          <FieldLabel label="Type de dossier suggéré"><select value={analysis.projectType} onChange={(event) => setAnalysis({ ...analysis, projectType: event.target.value as UniversalProjectType })} className={inputClass}><option value="unknown">À confirmer</option><option value="seller">Vendeur</option><option value="buyer">Acheteur</option><option value="buy_sell">Acheteur + vendeur</option><option value="prospect">Prospect</option><option value="other">Autre</option></select></FieldLabel>
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

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Partenaires détectés" icon={UserRound}>
          {analysis.partners.length ? analysis.partners.map((partner) => <div key={partner.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800"><p className="font-semibold">{`${partner.firstName} ${partner.lastName}`.trim() || partner.organization}</p><p className="mt-1 text-slate-600 dark:text-slate-300">{partnerLabel(partner.partnerType)}{partner.organization ? ` · ${partner.organization}` : ""}</p><p className="mt-1 text-xs text-slate-500">{partner.email || partner.phone || "Coordonnées à compléter"} · source : {partner.sourceName || "à confirmer"}</p></div>) : <p className="text-sm text-slate-500">Aucun professionnel distinct du client n’a été détecté.</p>}
        </Panel>
        <Panel title="Renseignements manquants" icon={AlertTriangle}>
          {missingInformation.length ? missingInformation.map((item) => <p key={item} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{item}</p>) : <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5" />Les renseignements essentiels du dossier suggéré sont présents.</div>}
        </Panel>
      </section>

      {(analysis.duplicates || []).length ? <Panel title="Doublons possibles — décision obligatoire" icon={Search}>{analysis.duplicates!.map((duplicate) => {
        const person = analysis.people.find((item) => item.id === duplicate.personId);
        return <div key={duplicate.personId} className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"><p className="font-semibold">{person ? `${person.firstName} ${person.lastName}`.trim() : "Personne"}</p>{duplicate.matches.map((match) => <label key={match.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-950"><input type="radio" name={`duplicate-${duplicate.personId}`} checked={decisions[duplicate.personId]?.action === "use" && decisions[duplicate.personId]?.existingContactId === match.id} onChange={() => choosePerson(duplicate.personId, "use", match.id)} className="mt-1" /><span className="min-w-0"><span className="block font-semibold">Utiliser {match.name}</span><span className="block text-xs text-slate-500">Correspondance : {match.matchedOn.join(", ")} · {match.email || match.phone || "coordonnées non renseignées"}</span><Link href={`/tableau-de-bord/clients?client=${match.id}`} target="_blank" className="mt-1 inline-flex text-xs font-semibold text-teal-700 underline">Voir cette fiche</Link></span></label>)}<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-950"><input type="radio" name={`duplicate-${duplicate.personId}`} checked={decisions[duplicate.personId]?.action === "create"} onChange={() => choosePerson(duplicate.personId, "create")} className="mt-1" /><span><span className="block font-semibold">Créer quand même une nouvelle fiche</span><span className="block text-xs text-slate-500">Confirmation explicite requise pour autoriser ce doublon.</span></span></label></div>;
      })}</Panel> : <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100"><CheckCircle2 className="h-5 w-5" />Aucun doublon client détecté selon le nom, le courriel ou le téléphone.</div>}

      {caseId && analysis.existingCase && unresolvedAssignments.length ? <Panel title="À qui appartient cette source ?" icon={UserRound}>
        {unresolvedAssignments.map((person) => <div key={person.id} className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <div><p className="font-semibold">{person.sourceName || `${person.firstName} ${person.lastName}`.trim()}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">IACourtier n’a pas une correspondance assez certaine. Choisis la bonne personne; aucune nouvelle fiche ne sera créée sans ton choix.</p></div>
          {analysis.existingCase!.clients.map((client) => <label key={client.id} className="flex cursor-pointer gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-950"><input type="radio" name={`assignment-${person.id}`} onChange={() => choosePerson(person.id, "use", client.id)} /><span><strong className="block">{`${client.firstName} ${client.lastName}`.trim()}</strong><span className="text-xs text-slate-500">{client.email || client.phone || "Coordonnées à compléter"}</span></span></label>)}
          <label className="flex cursor-pointer gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-950"><input type="radio" name={`assignment-${person.id}`} onChange={() => choosePerson(person.id, "create")} /><span><strong className="block">Créer une nouvelle personne</strong><span className="text-xs text-slate-500">Seulement si aucun client déjà relié ne correspond.</span></span></label>
        </div>)}
      </Panel> : null}

      {analysis.mergePreview ? <Panel title="Comparaison avec le dossier existant" icon={FileSearch}>
        <div className="grid gap-3 sm:grid-cols-4"><Stat label="Nouvelles" value={String(analysis.mergePreview.newCount)} /><Stat label="Déjà confirmées" value={String(analysis.mergePreview.unchangedCount)} /><Stat label="Conflits" value={String(analysis.mergePreview.conflictCount)} /><Stat label="Attributions" value={String(analysis.mergePreview.assignmentCount)} /></div>
        {analysis.mergePreview.proposals.filter((proposal) => proposal.status === "new").length ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100"><strong>Enrichissement automatique sans conflit</strong><p className="mt-1">{analysis.mergePreview.proposals.filter((proposal) => proposal.status === "new").map((proposal) => proposal.label).join(", ")}.</p></div> : null}
        {analysis.mergePreview.proposals.filter((proposal) => proposal.status === "conflict").map((proposal) => <MergeConflict key={proposal.id} proposal={proposal} decision={mergeDecisions[proposal.id]} onDecision={(action) => setMergeDecisions((current) => ({ ...current, [proposal.id]: { proposalId: proposal.id, action } }))} />)}
        {!analysis.mergePreview.conflictCount ? <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5" />Aucune donnée contradictoire. Les champs vides seront enrichis et les valeurs identiques confirmeront leur provenance.</div> : null}
      </Panel> : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Propriété" icon={FileSearch}>
          {analysis.propertyDuplicate ? <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/20">Propriété existante reconnue : <strong>{analysis.propertyDuplicate.address}, {analysis.propertyDuplicate.city}</strong>. Elle sera réutilisée.</div> : null}
          <div className="grid gap-3 sm:grid-cols-2"><Editable label="Adresse" value={analysis.property.address} onChange={(address) => setAnalysis({ ...analysis, property: { ...analysis.property, address } })} wide /><Editable label="Ville" value={analysis.property.city} onChange={(city) => setAnalysis({ ...analysis, property: { ...analysis.property, city } })} /><Editable label="Code postal" value={analysis.property.postalCode} onChange={(postalCode) => setAnalysis({ ...analysis, property: { ...analysis.property, postalCode } })} /><Editable label="Type" value={analysis.property.propertyType} onChange={(propertyType) => setAnalysis({ ...analysis, property: { ...analysis.property, propertyType } })} /><Editable label="Lot" value={analysis.property.lotNumber} onChange={(lotNumber) => setAnalysis({ ...analysis, property: { ...analysis.property, lotNumber } })} /></div>
        </Panel>
        <Panel title="Critères acheteur" icon={Search}>
          <div className="grid gap-3 sm:grid-cols-2"><Editable label="Budget maximal" value={analysis.buyerCriteria.budget} onChange={(budget) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, budget } })} /><Editable label="Préqualification" value={analysis.buyerCriteria.preapprovalStatus} onChange={(preapprovalStatus) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, preapprovalStatus } })} /><Editable label="Mise de fonds" value={analysis.buyerCriteria.downPayment} onChange={(downPayment) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, downPayment } })} /><Editable label="Montant hypothécaire total" value={analysis.buyerCriteria.mortgageAmount} onChange={(mortgageAmount) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, mortgageAmount } })} /><Editable label="Occupation" value={analysis.buyerCriteria.occupancyType} onChange={(occupancyType) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, occupancyType } })} /><Editable label="Prêteur" value={analysis.buyerCriteria.lender} onChange={(lender) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, lender } })} /><Editable label="Date de préqualification" value={analysis.buyerCriteria.preapprovalDate} onChange={(preapprovalDate) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, preapprovalDate } })} /><Editable label="Date d’expiration" value={analysis.buyerCriteria.expiryDate} onChange={(expiryDate) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, expiryDate } })} /><Editable label="Secteurs" value={analysis.buyerCriteria.sectors.join(", ")} onChange={(value) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, sectors: value.split(",").map((item) => item.trim()).filter(Boolean) } })} wide /><Editable label="Type recherché" value={analysis.buyerCriteria.propertyType} onChange={(propertyType) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, propertyType } })} /><Editable label="Chambres" value={analysis.buyerCriteria.bedrooms} onChange={(bedrooms) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, bedrooms } })} /><Editable label="Échéancier" value={analysis.buyerCriteria.timeline} onChange={(timeline) => setAnalysis({ ...analysis, buyerCriteria: { ...analysis.buyerCriteria, timeline } })} wide /></div>
        </Panel>
      </section>

      <Panel title="Provenance et confiance" icon={FileSearch}>
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">{analysis.facts.map((fact, index) => <div key={`${fact.field}-${fact.sourceName}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800 sm:grid-cols-[1fr_1fr_auto]"><span><span className="block font-semibold">{fact.label}</span><span className="block break-words text-slate-600 dark:text-slate-300">{fact.value}</span></span><span className="text-xs text-slate-500"><span className="block">Source : {fact.sourceName}</span><span className="block">Type : {fact.sourceType}</span>{fact.note ? <span className="block">{fact.note}</span> : null}</span><span className={`h-fit rounded-full px-2 py-1 text-xs font-semibold ${fact.status === "confirmed" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{fact.status === "confirmed" ? "Confirmé" : "À confirmer"}{fact.confidence !== null ? ` · ${Math.round(fact.confidence * 100)} %` : ""}</span></div>)}</div>
      </Panel>

      {analysis.ambiguities.length ? <Panel title="Ambiguïtés à valider" icon={AlertTriangle}>{analysis.ambiguities.map((ambiguity) => <p key={ambiguity} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{ambiguity}</p>)}</Panel> : null}

      <section className="sticky bottom-3 z-10 rounded-2xl border border-slate-300 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Confirmation finale</p><p className="text-xs text-slate-500">{caseId ? "Après ce clic seulement : document, provenances et enrichissements validés seront reliés au même dossier." : "Après ce clic seulement : fiche client centrale, dossier, financement, partenaire, document, étape, tâches et automatisations seront reliés."}</p>{unresolvedDuplicates.length ? <p className="mt-1 text-xs font-semibold text-amber-700">Choisis quoi faire pour {unresolvedDuplicates.length} doublon{unresolvedDuplicates.length > 1 ? "s" : ""}.</p> : null}{unresolvedAssignments.length ? <p className="mt-1 text-xs font-semibold text-amber-700">Attribue {unresolvedAssignments.length} personne{unresolvedAssignments.length > 1 ? "s" : ""} au dossier.</p> : null}{unresolvedMergeConflicts.length ? <p className="mt-1 text-xs font-semibold text-amber-700">Résous {unresolvedMergeConflicts.length} information{unresolvedMergeConflicts.length > 1 ? "s" : ""} différente{unresolvedMergeConflicts.length > 1 ? "s" : ""}.</p> : null}</div><button type="button" disabled={!canConfirm} onClick={() => void confirm()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950">{status === "confirming" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{status === "confirming" ? "Enregistrement…" : caseId ? "Confirmer et enrichir ce dossier" : "Confirmer et créer / mettre à jour le dossier"}</button></div></section>
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
function MergeConflict({ proposal, decision, onDecision }: { proposal: MergeProposal; decision?: MergeDecision; onDecision: (action: MergeDecision["action"]) => void }) {
  const choices = mergeChoices(proposal);
  return <div className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
    <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h3 className="font-semibold">Information différente détectée — {proposal.label}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{proposal.reason}</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><ReadOnly label="Valeur actuelle" value={proposal.currentValue || "Aucune"} /><ReadOnly label="Nouvelle valeur" value={proposal.incomingValue} /></div>
    <p className="text-xs text-slate-500">Source : {proposal.sourceName} · confiance {proposal.confidence == null ? "à confirmer" : `${Math.round(proposal.confidence * 100)} %`} · priorité {proposal.sourcePriority}/100</p>
    <div className="grid gap-2 sm:grid-cols-2">{choices.map((choice) => <label key={choice.action} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${decision?.action === choice.action ? "border-teal-600 bg-teal-50 dark:bg-teal-950/30" : "border-amber-200 bg-white dark:border-amber-900 dark:bg-slate-950"}`}><input type="radio" name={`merge-${proposal.id}`} checked={decision?.action === choice.action} onChange={() => onDecision(choice.action)} className="mt-1" /><span><strong className="block text-sm">{choice.label}</strong><span className="text-xs text-slate-500">{choice.detail}</span></span></label>)}</div>
  </div>;
}
function mergeChoices(proposal: MergeProposal): Array<{ action: MergeDecision["action"]; label: string; detail: string }> {
  const secondary = proposal.field === "phone" ? "Ajouter comme deuxième téléphone" : proposal.field === "email" ? "Ajouter comme deuxième courriel" : proposal.field === "mailingAddress" ? "Conserver les deux adresses" : "Conserver comme donnée secondaire";
  const replace = proposal.field === "mailingAddress" ? "Utiliser comme adresse personnelle" : "Remplacer";
  return [
    { action: "replace", label: `${replace}${proposal.recommendedAction === "replace" ? " · recommandé" : ""}`, detail: "La nouvelle valeur devient la valeur principale; l’ancienne reste dans l’historique." },
    { action: "add_secondary", label: secondary, detail: "La valeur actuelle reste principale et la nouvelle est conservée séparément." },
    { action: "keep_existing", label: `Conserver l’actuelle${proposal.recommendedAction === "keep_existing" ? " · recommandé" : ""}`, detail: "La source est archivée, sans modifier la fiche active." },
    { action: "ignore", label: "Ignorer cette nouvelle valeur", detail: "La valeur proposée est journalisée comme rejetée." },
  ];
}
function summarizePreview(preview: NonNullable<UniversalAnalysis["mergePreview"]>, proposals: MergeProposal[]) {
  return {
    ...preview, proposals,
    newCount: proposals.filter((item) => item.status === "new").length,
    unchangedCount: proposals.filter((item) => item.status === "same").length,
    conflictCount: proposals.filter((item) => item.status === "conflict").length,
    assignmentCount: proposals.filter((item) => item.status === "needs_assignment").length,
  };
}
function equivalentPreview(field: string, first: string, second: string) {
  if (field === "phone") return first.replace(/\D/g, "") === second.replace(/\D/g, "");
  if (field === "email") return first.trim().toLowerCase() === second.trim().toLowerCase();
  return first.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === second.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`; }
function partnerLabel(type: UniversalAnalysis["partners"][number]["partnerType"]) { return ({ mortgage_broker: "Courtier hypothécaire", real_estate_broker: "Courtier immobilier", notary: "Notaire", inspector: "Inspecteur", lender: "Prêteur", other: "Autre partenaire" } as const)[type]; }
function findMissingInformation(analysis: UniversalAnalysis) {
  const missing: string[] = [];
  if (analysis.people.some((person) => !person.email)) missing.push("Courriel client manquant");
  if (analysis.people.some((person) => !person.phone)) missing.push("Téléphone client manquant");
  if ((analysis.projectType === "buyer" || analysis.projectType === "buy_sell") && !analysis.buyerCriteria.budget) missing.push("Budget maximal manquant");
  if ((analysis.projectType === "buyer" || analysis.projectType === "buy_sell") && !analysis.buyerCriteria.propertyType) missing.push("Type de propriété recherché manquant");
  if ((analysis.projectType === "seller" || analysis.projectType === "buy_sell") && !analysis.property.address) missing.push("Adresse de la propriété manquante");
  return [...new Set(missing)];
}

