"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileSearch, Loader2, Plus, Search, UploadCloud, UserPlus, Users } from "lucide-react";

import {
  emptyExtractedMandateFields,
  type ExtractedMandateFields,
  type MandateDocumentExtractionResponse,
} from "@/lib/mandate-document-extraction";
import {
  LISTING_FACT_DEFINITIONS,
  type ListingFact,
  type ListingFactStatus,
  type SellerContactInput,
} from "@/lib/seller-listings";

type EntryMode = "choice" | "existing" | "new" | "documents" | "review";
type ContactRow = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; mailing_address: string | null };

const blankSeller = (): SellerContactInput => ({ firstName: "", lastName: "", email: "", phone: "", mailingAddress: "" });
const accepted = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp";

export function NewSellerListing() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<EntryMode>("choice");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [sellers, setSellers] = useState<SellerContactInput[]>([blankSeller()]);
  const [fields, setFields] = useState<ExtractedMandateFields>(emptyExtractedMandateFields);
  const [facts, setFacts] = useState<ListingFact[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [documentTypes, setDocumentTypes] = useState<Array<{ name: string; type: string }>>([]);
  const [status, setStatus] = useState<"idle" | "analyzing" | "saving">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/seller-contacts")
      .then(async (response) => ({ ok: response.ok, payload: await response.json() as { contacts?: ContactRow[]; error?: string } }))
      .then(({ ok, payload }) => {
        if (ok) setContacts(payload.contacts || []);
        else setNotice(payload.error || "Les vendeurs existants ne peuvent pas être chargés.");
      })
      .catch(() => setNotice("Les vendeurs existants ne peuvent pas être chargés pour le moment."));
  }, []);

  const reviewGroups = useMemo(() => ({
    confirmed: facts.filter((fact) => fact.status === "confirmed" && fact.value),
    toConfirm: facts.filter((fact) => fact.status === "to_confirm"),
    missing: facts.filter((fact) => fact.status === "missing" || !fact.value),
  }), [facts]);

  function chooseMode(nextMode: Exclude<EntryMode, "choice" | "review">) {
    setMode(nextMode);
    setError("");
    setNotice("");
    if (nextMode !== "documents") setFacts(manualFacts(fields));
  }

  function addFiles(next: File[]) {
    const supported = next.filter((file) => /\.(pdf|jpe?g|png|heic|heif|webp)$/i.test(file.name));
    setFiles((current) => [...current, ...supported].slice(0, 20));
    setError(supported.length === next.length ? "" : "Certains fichiers ont été ignorés. Formats acceptés : PDF, JPG, PNG, HEIC et WEBP.");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function analyzeDocuments() {
    if (!files.length) return setError("Déposez au moins un document.");
    setStatus("analyzing");
    setError("");
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch("/api/extract-mandate-documents", { method: "POST", body: formData });
      const payload = await response.json() as MandateDocumentExtractionResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "L’analyse documentaire a échoué.");
      setFields(payload.fields);
      setSellers(payload.fields.sellers.length ? payload.fields.sellers.map((seller) => ({
        firstName: seller.firstName,
        lastName: seller.lastName,
        email: seller.email,
        phone: seller.phone,
        mailingAddress: seller.mailingAddress,
      })) : [blankSeller()]);
      setFacts(completeReviewFacts(payload.facts || []));
      setDocumentTypes(payload.documentTypes || []);
      setMode("review");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’analyse documentaire a échoué.");
    } finally {
      setStatus("idle");
    }
  }

  function updateSeller(index: number, key: keyof SellerContactInput, value: string) {
    setSellers((current) => current.map((seller, sellerIndex) => sellerIndex === index ? { ...seller, [key]: value } : seller));
  }

  function updateField<K extends keyof ExtractedMandateFields>(key: K, value: ExtractedMandateFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function updateFact(index: number, updates: Partial<ListingFact>) {
    setFacts((current) => current.map((fact, factIndex) => factIndex === index ? { ...fact, ...updates } : fact));
  }

  async function createListing() {
    const normalizedSellers = sellers.filter((seller) => seller.firstName.trim() || seller.lastName.trim());
    if (!fields.address.trim() || !fields.city.trim()) return setError("L’adresse et la ville sont nécessaires avant de créer le dossier.");
    if (!existingIds.length && !normalizedSellers.length) return setError("Sélectionnez ou ajoutez au moins un vendeur.");
    setStatus("saving");
    setError("");
    try {
      const allFacts = mergeManualFacts(facts, fields, normalizedSellers, existingIds.length > 0);
      const response = await fetch("/api/seller-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingContactIds: existingIds,
          sellers: normalizedSellers,
          property: {
            address: fields.address,
            city: fields.city,
            postalCode: fields.postalCode,
            propertyType: fields.propertyType,
            lotNumber: fields.lotNumber,
          },
          facts: allFacts,
          entryMode: mode === "review" || files.length ? "documents" : existingIds.length ? "existing" : "new",
        }),
      });
      const payload = await response.json() as { id?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "Le dossier n’a pas pu être créé.");

      if (files.length) {
        const documentForm = new FormData();
        files.forEach((file) => documentForm.append("files", file));
        documentForm.append("documentTypes", JSON.stringify(documentTypes));
        const uploadResponse = await fetch(`/api/seller-listings/${payload.id}/documents`, { method: "POST", body: documentForm });
        if (!uploadResponse.ok) {
          const uploadPayload = await uploadResponse.json().catch(() => null) as { error?: string } | null;
          window.sessionStorage.setItem(
            `iacourtier-listing-notice-${payload.id}`,
            `Le dossier est sauvegardé, mais les documents doivent être téléversés de nouveau : ${uploadPayload?.error || "erreur de téléversement"}`,
          );
          router.push(`/tableau-de-bord/inscriptions/${payload.id}`);
          return;
        }
      }
      router.push(`/tableau-de-bord/inscriptions/${payload.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le dossier n’a pas pu être créé.");
    } finally {
      setStatus("idle");
    }
  }

  if (mode === "choice") {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm font-semibold text-teal-700">Coach IA · Nouvelle inscription vendeur</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Comment veux-tu démarrer?</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">Le Coach créera le vendeur, la propriété et leur dossier commun sans t’envoyer vers un écran générique.</p>
        </header>
        <div className="grid gap-4 lg:grid-cols-3">
          <ChoiceCard icon={Search} title="Rechercher un client existant" text="Relier un vendeur déjà enregistré à cette propriété." onClick={() => chooseMode("existing")} />
          <ChoiceCard icon={UserPlus} title="Créer un nouveau vendeur" text="Créer un ou deux propriétaires, puis leur propriété." onClick={() => chooseMode("new")} />
          <ChoiceCard icon={FileSearch} title="Déposer les documents" text="Identifier ou créer automatiquement les vendeurs à partir des vraies pièces du dossier." onClick={() => chooseMode("documents")} featured />
        </div>
        {notice ? <Notice text={notice} /> : null}
      </div>
    );
  }

  if (mode === "documents") {
    return (
      <div className="space-y-6">
        <BackButton onClick={() => setMode("choice")} />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-teal-700">Identification intelligente</p>
          <h1 className="mt-2 text-3xl font-semibold">Dépose les documents de la propriété</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">J’extrais uniquement les données réellement présentes. Chaque valeur conserve son document source et les ambiguïtés restent à confirmer.</p>
          <input ref={inputRef} className="hidden" type="file" multiple accept={accepted} onChange={(event) => addFiles(Array.from(event.target.files || []))} />
          <div onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className="mt-6 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950">
            <UploadCloud className="h-10 w-10 text-teal-600" />
            <p className="mt-3 font-semibold">Choisir ou glisser plusieurs PDF et images</p>
            <p className="mt-1 text-xs text-slate-500">Jusqu’à 20 fichiers, 12 Mo chacun pour l’analyse</p>
          </div>
          {files.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><span className="truncate">{file.name}</span><button type="button" className="ml-2 text-xs text-red-600" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Retirer</button></div>)}</div> : null}
          {error ? <ErrorNotice text={error} /> : null}
          <button type="button" onClick={analyzeDocuments} disabled={!files.length || status === "analyzing"} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-5 font-semibold text-white disabled:opacity-50">
            {status === "analyzing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
            {status === "analyzing" ? "Analyse en cours…" : "Analyser les documents"}
          </button>
        </section>
      </div>
    );
  }

  if (mode === "review") {
    return (
      <div className="space-y-6">
        <BackButton onClick={() => setMode("documents")} />
        <header>
          <p className="text-sm font-semibold text-teal-700">Vérification guidée</p>
          <h1 className="mt-2 text-3xl font-semibold">Confirme ce que les documents disent vraiment</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Le Coach te demande seulement les données absentes, ambiguës ou contradictoires.</p>
        </header>
        <SellerEditors sellers={sellers} updateSeller={updateSeller} addSeller={() => setSellers((current) => [...current, blankSeller()].slice(0, 2))} removeSeller={(index) => setSellers((current) => current.filter((_, sellerIndex) => sellerIndex !== index))} />
        <PropertyEditor fields={fields} updateField={updateField} />
        <FactGroup title="Informations confirmées" tone="green" facts={reviewGroups.confirmed} allFacts={facts} updateFact={updateFact} />
        <FactGroup title="À confirmer" tone="amber" facts={reviewGroups.toConfirm} allFacts={facts} updateFact={updateFact} />
        <FactGroup title="Informations manquantes" tone="slate" facts={reviewGroups.missing} allFacts={facts} updateFact={updateFact} />
        {error ? <ErrorNotice text={error} /> : null}
        <button type="button" onClick={createListing} disabled={status === "saving"} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-6 font-semibold text-white disabled:opacity-50">
          {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Créer et sauvegarder mon dossier vendeur
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton onClick={() => setMode("choice")} />
      <header>
        <p className="text-sm font-semibold text-teal-700">{mode === "existing" ? "Client existant" : "Nouveau vendeur"}</p>
        <h1 className="mt-2 text-3xl font-semibold">Créer le dossier vendeur</h1>
      </header>
      {mode === "existing" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Rechercher un vendeur</h2>
          <select value={existingIds[0] || ""} onChange={(event) => setExistingIds(event.target.value ? [event.target.value] : [])} className="mt-4 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Choisir un client existant</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{`${contact.first_name} ${contact.last_name}`.trim()} · {contact.email || contact.phone || "coordonnées à compléter"}</option>)}
          </select>
          {!contacts.length ? <p className="mt-3 text-sm text-amber-700">Aucun vendeur réel n’est encore enregistré. Reviens et choisis « Créer un nouveau vendeur ».</p> : null}
        </section>
      ) : <SellerEditors sellers={sellers} updateSeller={updateSeller} addSeller={() => setSellers((current) => [...current, blankSeller()].slice(0, 2))} removeSeller={(index) => setSellers((current) => current.filter((_, sellerIndex) => sellerIndex !== index))} />}
      <PropertyEditor fields={fields} updateField={updateField} includePreparationFields />
      {error ? <ErrorNotice text={error} /> : null}
      {notice ? <Notice text={notice} /> : null}
      <button type="button" onClick={createListing} disabled={status === "saving"} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-6 font-semibold text-white disabled:opacity-50">
        {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Créer et sauvegarder mon dossier vendeur
      </button>
    </div>
  );
}

function ChoiceCard({ icon: Icon, title, text, onClick, featured = false }: { icon: typeof Search; title: string; text: string; onClick: () => void; featured?: boolean }) {
  return <button type="button" onClick={onClick} className={`min-h-56 rounded-2xl border p-6 text-left transition hover:-translate-y-1 hover:shadow-lg ${featured ? "border-teal-400 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}><Icon className="h-7 w-7 text-teal-700" /><h2 className="mt-8 text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p></button>;
}

function SellerEditors({ sellers, updateSeller, addSeller, removeSeller }: { sellers: SellerContactInput[]; updateSeller: (index: number, key: keyof SellerContactInput, value: string) => void; addSeller: () => void; removeSeller: (index: number) => void }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-teal-700">Vendeur(s)</p><h2 className="mt-1 text-xl font-semibold">Propriétaires à relier</h2></div>{sellers.length < 2 ? <button type="button" onClick={addSeller} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700"><Plus className="h-4 w-4" />Deuxième propriétaire</button> : null}</div><div className="mt-5 space-y-5">{sellers.map((seller, index) => <div key={index} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" />Propriétaire {index + 1}</p>{sellers.length > 1 ? <button type="button" onClick={() => removeSeller(index)} className="text-xs text-red-600">Retirer</button> : null}</div><div className="grid gap-3 md:grid-cols-2"><Input label="Prénom" value={seller.firstName} onChange={(value) => updateSeller(index, "firstName", value)} /><Input label="Nom" value={seller.lastName} onChange={(value) => updateSeller(index, "lastName", value)} /><Input label="Courriel" type="email" value={seller.email} onChange={(value) => updateSeller(index, "email", value)} /><Input label="Téléphone" type="tel" value={seller.phone} onChange={(value) => updateSeller(index, "phone", value)} /><Input label="Adresse postale" value={seller.mailingAddress} onChange={(value) => updateSeller(index, "mailingAddress", value)} className="md:col-span-2" /></div></div>)}</div></section>;
}

function PropertyEditor({ fields, updateField, includePreparationFields = false }: { fields: ExtractedMandateFields; updateField: <K extends keyof ExtractedMandateFields>(key: K, value: ExtractedMandateFields[K]) => void; includePreparationFields?: boolean }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-semibold text-teal-700">Propriété</p><h2 className="mt-1 text-xl font-semibold">Fiche de la propriété</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><Input label="Adresse *" value={fields.address} onChange={(value) => updateField("address", value)} /><Input label="Ville *" value={fields.city} onChange={(value) => updateField("city", value)} /><Input label="Code postal" value={fields.postalCode} onChange={(value) => updateField("postalCode", value)} /><Input label="Type de propriété" value={fields.propertyType} onChange={(value) => updateField("propertyType", value)} /><Input label="Numéro de lot" value={fields.lotNumber} onChange={(value) => updateField("lotNumber", value)} />{includePreparationFields ? <><Input label="Prix demandé" value={fields.askingPrice} onChange={(value) => updateField("askingPrice", value)} /><Input label="Date ou modalité d’occupation" value={fields.occupancyDate} onChange={(value) => updateField("occupancyDate", value)} /></> : null}</div></section>;
}

function FactGroup({ title, tone, facts, allFacts, updateFact }: { title: string; tone: "green" | "amber" | "slate"; facts: ListingFact[]; allFacts: ListingFact[]; updateFact: (index: number, updates: Partial<ListingFact>) => void }) {
  const colors = tone === "green" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" : tone === "amber" ? "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
  return <section className={`rounded-2xl border p-5 ${colors}`}><h2 className="text-xl font-semibold">{title}</h2>{facts.length ? <div className="mt-4 grid gap-3">{facts.map((fact) => { const index = allFacts.indexOf(fact); return <div key={`${fact.key}-${index}`} className="rounded-xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-slate-950"><div className="grid gap-3 md:grid-cols-[1fr_auto]"><label><span className="text-sm font-semibold">{fact.label}</span><input value={fact.value} onChange={(event) => updateFact(index, { value: event.target.value, status: event.target.value ? "to_confirm" : "missing", sourceLabel: "Correction du courtier" })} className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label><select value={fact.status} onChange={(event) => updateFact(index, { status: event.target.value as ListingFactStatus, sourceLabel: event.target.value === "confirmed" && fact.sourceLabel.includes("Aucun") ? "Confirmation du courtier" : fact.sourceLabel })} className="min-h-11 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="confirmed">Confirmée</option><option value="to_confirm">À confirmer</option><option value="missing">Manquante</option></select></div><p className="mt-2 text-xs text-slate-500">Source : {fact.sourceLabel}{fact.note ? ` · ${fact.note}` : ""}</p></div>; })}</div> : <p className="mt-3 text-sm text-slate-500">Aucune information dans cette catégorie.</p>}</section>;
}

function Input({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string }) {
  return <label className={className}><span className="mb-1 block text-sm font-medium">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>;
}

function BackButton({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><ArrowLeft className="h-4 w-4" />Retour</button>; }
function ErrorNotice({ text }: { text: string }) { return <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{text}</p>; }
function Notice({ text }: { text: string }) { return <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{text}</p>; }

function completeReviewFacts(extracted: ListingFact[]) {
  const facts = [...extracted];
  for (const definition of LISTING_FACT_DEFINITIONS) {
    if (facts.some((fact) => fact.key === definition.key)) continue;
    facts.push({ key: definition.key, label: definition.label, value: "", status: "missing", sourceLabel: "Aucun document" });
  }
  return facts;
}

function manualFacts(fields: ExtractedMandateFields) {
  const record = fields as unknown as Record<string, unknown>;
  return LISTING_FACT_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    value: String(record[definition.key] || ""),
    status: String(record[definition.key] || "") ? "confirmed" as const : "missing" as const,
    sourceLabel: String(record[definition.key] || "") ? "Saisie du courtier" : "Aucun document",
    confidence: String(record[definition.key] || "") ? 1 : null,
  }));
}

function mergeManualFacts(facts: ListingFact[], fields: ExtractedMandateFields, sellers: SellerContactInput[], hasExistingSeller: boolean) {
  const output: ListingFact[] = facts.length ? [...facts] : manualFacts(fields);
  const values: Record<string, string> = {
    address: fields.address,
    city: fields.city,
    postalCode: fields.postalCode,
    propertyType: fields.propertyType,
    lotNumber: fields.lotNumber,
    askingPrice: fields.askingPrice,
    marketDate: fields.marketDate,
    occupancyDate: fields.occupancyDate,
    owners: sellers.map((seller) => `${seller.firstName} ${seller.lastName}`.trim()).filter(Boolean).join(" et "),
  };
  for (const [key, value] of Object.entries(values)) {
    if (!value || (key === "owners" && hasExistingSeller)) continue;
    const current = output.find((fact) => fact.key === key);
    if (current && !current.value) Object.assign(current, { value, status: "confirmed", sourceLabel: "Saisie du courtier", confidence: 1 });
    else if (!current) {
      const definition = LISTING_FACT_DEFINITIONS.find((item) => item.key === key);
      output.push({ key, label: definition?.label || key, value, status: "confirmed", sourceLabel: "Saisie du courtier", confidence: 1 });
    }
  }
  return output;
}
