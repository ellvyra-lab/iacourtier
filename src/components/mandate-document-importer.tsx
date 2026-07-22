"use client";

import type { DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, Home, Loader2, UploadCloud, X } from "lucide-react";

import { emptyExtractedMandateFields, type ExtractedMandateFields, type ExtractedSeller, type MandateDocumentExtractionResponse } from "@/lib/mandate-document-extraction";
import { getSoniaProspects, upsertSoniaProspect } from "@/lib/sonia-beta/storage";
import type { ClientRelationshipType, SoniaProspect } from "@/lib/sonia-beta/types";
import { officialBuyerWorkflow, officialSellerWorkflow } from "@/lib/business-rules";
import { cn } from "@/lib/utils";

type ContactRole = "buyer" | "seller" | "investor" | "owner";
type ExtractedParty = ExtractedSeller & { roles: ContactRole[] };
type TextFieldKey = Exclude<keyof ExtractedMandateFields, "sellers" | "buyers">;
type DuplicateDecision = "merge" | "update" | "create";
type ExistingProperty = Record<string, unknown> & { id: string; address?: string; city?: string };

const accepted = [".pdf", ".jpg", ".jpeg", ".png", ".heic"];
const fieldGroups: Array<{ title: string; fields: Array<{ key: TextFieldKey; label: string; multiline?: boolean }> }> = [
  { title: "Propriété", fields: [
    { key: "address", label: "Adresse" }, { key: "city", label: "Ville" }, { key: "postalCode", label: "Code postal" },
    { key: "propertyType", label: "Type de propriété" }, { key: "transactionType", label: "Type de dossier" }, { key: "lotNumber", label: "Numéro de lot" },
    { key: "yearBuilt", label: "Année" }, { key: "dimensions", label: "Dimensions" }, { key: "livingArea", label: "Superficie habitable" },
    { key: "landArea", label: "Terrain" }, { key: "bedrooms", label: "Chambres" }, { key: "bathrooms", label: "Salles de bain" },
    { key: "garage", label: "Garage" }, { key: "pool", label: "Piscine" }, { key: "fireplace", label: "Foyer" },
    { key: "parking", label: "Stationnements" }, { key: "zoning", label: "Zonage" }, { key: "servitudes", label: "Servitudes", multiline: true },
  ]},
  { title: "Taxes et évaluation", fields: [
    { key: "municipalTaxes", label: "Taxes municipales" }, { key: "schoolTaxes", label: "Taxes scolaires" },
    { key: "municipalAssessment", label: "Évaluation municipale" },
  ]},
  { title: "Hypothèque", fields: [
    { key: "mortgageLender", label: "Prêteur" }, { key: "mortgageDate", label: "Date" },
    { key: "mortgageAmount", label: "Montant" }, { key: "mortgageMaturity", label: "Échéance" },
  ]},
  { title: "Mise en marché", fields: [
    { key: "askingPrice", label: "Prix demandé" }, { key: "marketDate", label: "Date de mise en marché" },
    { key: "availability", label: "Disponibilité" }, { key: "importantInfo", label: "Informations importantes", multiline: true },
    { key: "missingInfo", label: "Informations manquantes", multiline: true },
  ]},
];

export function MandateDocumentImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState<ExtractedMandateFields>(emptyExtractedMandateFields);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "extracting" | "ready" | "created" | "error">("idle");
  const [error, setError] = useState("");
  const [contactDecisions, setContactDecisions] = useState<Record<number, DuplicateDecision>>({});
  const [propertyDecision, setPropertyDecision] = useState<DuplicateDecision | "">("");
  const [createdId, setCreatedId] = useState("");

  const contacts = status === "ready" ? getSoniaProspects().filter((contact) => !contact.id.startsWith("sonia-demo-")) : [];
  const parties = useMemo(() => normalizedParties(fields), [fields]);
  const contactDuplicates = parties.map((party) => findContactDuplicate(contacts, party));
  const existingProperty = status === "ready" ? findExistingProperty(fields.address, fields.city) : null;
  const foundFields = Object.entries(fields).filter(([key, value]) => key !== "sellers" && key !== "buyers" && typeof value === "string" && value.trim()).map(([key]) => key);
  const missing = [
    !fields.askingPrice ? "prix demandé" : "", !fields.marketDate ? "date de mise en marché" : "",
    !fields.availability ? "disponibilité" : "",
  ].filter(Boolean);

  function addFiles(nextFiles: File[]) {
    const valid = nextFiles.filter((file) => accepted.some((extension) => file.name.toLowerCase().endsWith(extension)));
    setFiles((current) => [...current, ...valid].slice(0, 12));
    setError(valid.length === nextFiles.length ? "" : "Certains fichiers ont été ignorés. Formats acceptés : PDF, JPG, JPEG, PNG et HEIC.");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  function updateField(key: TextFieldKey, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function extractDocuments() {
    if (!files.length) return setError("Déposez au moins un document.");
    setStatus("extracting");
    setError("");
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    try {
      const response = await fetch("/api/extract-mandate-documents", { method: "POST", body: formData });
      const payload = await response.json() as MandateDocumentExtractionResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "L’analyse a échoué.");
      setFields(payload.fields);
      setFileNames(payload.fileNames);
      setContactDecisions({});
      setPropertyDecision("");
      setStatus("ready");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "L’analyse a échoué.");
    }
  }

  function validateAndCreate() {
    const unresolvedContact = contactDuplicates.findIndex((duplicate, index) => duplicate && !contactDecisions[index]);
    if (unresolvedContact >= 0) {
      const unresolvedParty = parties[unresolvedContact];
      setError(unresolvedParty
        ? `Choisissez comment traiter le doublon de ${unresolvedParty.firstName} ${unresolvedParty.lastName}.`
        : "Choisissez comment traiter le doublon détecté.");
      return;
    }
    if (existingProperty && !propertyDecision) {
      setError("Choisissez comment traiter la propriété existante.");
      return;
    }
    if (!fields.address.trim() || !fields.city.trim()) {
      setError("L’adresse et la ville sont nécessaires avant la création.");
      return;
    }

    const partyLinks: Array<{ contactId: string; roles: ContactRole[] }> = [];
    parties.forEach((party, index) => {
      const duplicate = contactDuplicates[index];
      const decision = contactDecisions[index];
      if (duplicate && decision !== "create") {
        const updated = contactFromParty(party, duplicate, decision === "update");
        upsertSoniaProspect(updated);
        partyLinks.push({ contactId: updated.id, roles: party.roles });
      } else {
        const created = contactFromParty(party);
        upsertSoniaProspect(created);
        partyLinks.push({ contactId: created.id, roles: party.roles });
      }
    });

    const newId = existingProperty && propertyDecision !== "create" ? existingProperty.id : `local-${Date.now()}`;
    const extracted = propertyPayload(newId, fields, fileNames, partyLinks);
    const payload = existingProperty && propertyDecision === "merge"
      ? mergeProperty(existingProperty, extracted, false)
      : existingProperty && propertyDecision === "update"
        ? mergeProperty(existingProperty, extracted, true)
        : extracted;
    window.localStorage.setItem(`iacourtier-mandate-${newId}`, JSON.stringify(payload));
    setCreatedId(newId);
    setStatus("created");
    setError("");
  }

  if (status === "created") {
    const actions = ["Préparer la fiche Centris", "Générer la description", "Préparer les publications Facebook", "Préparer Instagram", "Préparer TikTok", "Préparer les Stories", "Préparer les scripts vidéo", "Préparer la campagne courriel", "Préparer les affiches"];
    return <section className="rounded-lg border border-teal-200 bg-white p-6 shadow-sm dark:border-teal-900 dark:bg-slate-900"><p className="text-sm font-semibold text-teal-700">Dossier créé</p><h2 className="mt-2 text-2xl font-semibold">{fields.address}, {fields.city}</h2><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Les vendeurs et la propriété sont reliés. Les documents analysés et les informations extraites sont conservés dans le dossier.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{actions.map((action, index) => index === 0 ? <Link key={action} href={`/tableau-de-bord/mandats/local/${createdId}`} className="min-h-12 rounded-lg bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white dark:bg-white dark:text-slate-950">{action}</Link> : <button key={action} type="button" onClick={() => setError(`${action} : bientôt disponible.`)} className="min-h-12 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-700">{action}<span className="ml-2 text-xs text-slate-400">Bientôt</span></button>)}</div>{error ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">{error}</p> : null}</section>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <section className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
          <p className="text-sm font-medium text-teal-700">Création intelligente</p>
          <h2 className="mt-2 text-2xl font-semibold">Déposez les documents de la propriété</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Actes, certificat, déclaration du vendeur, taxes, évaluation, inspection, plans et photos peuvent être analysés ensemble.</p>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic" multiple className="hidden" onChange={(event) => addFiles(Array.from(event.target.files || []))} />
          <label onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950/60">
            <UploadCloud className="h-10 w-10 text-teal-600" /><span className="mt-4 font-semibold">Glissez plusieurs documents ici</span><span className="mt-2 text-sm text-slate-500">PDF, JPG, JPEG, PNG ou HEIC · 12 fichiers maximum</span>
          </label>
          {files.length ? <div className="mt-4 space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-teal-600" /><span className="truncate">{file.name}</span></span><button type="button" onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}><X className="h-4 w-4" /></button></div>)}</div> : null}
          <button type="button" onClick={extractDocuments} disabled={!files.length || status === "extracting"} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">{status === "extracting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{status === "extracting" ? "Analyse en cours…" : "Analyser les documents"}</button>
          {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}
        </div>
        {status === "ready" ? <Summary files={fileNames.length} sellers={parties.length} existingContacts={contactDuplicates.filter(Boolean).length} propertyExists={Boolean(existingProperty)} found={foundFields.length} missing={missing} /> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-teal-700">Validation obligatoire</p><h2 className="mt-2 text-2xl font-semibold">Vérifiez le dossier avant création</h2></div>{status === "ready" ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">Prêt</span> : null}</div>
        {status === "ready" ? <>
          <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100"><strong>Coach IA</strong><p className="mt-1">J’ai analysé {fileNames.length} document{fileNames.length > 1 ? "s" : ""}. {parties.length} client{parties.length > 1 ? "s ont" : " a"} été identifié{parties.length > 1 ? "s" : ""} ({roleSummary(parties)}). Une {existingProperty ? "propriété existante a été trouvée" : "nouvelle propriété sera créée"}. {missing.length ? `Il manque : ${missing.join(", ")}.` : "Les informations essentielles sont présentes."}</p></div>
          <div className="mt-6 space-y-6">{fieldGroups.map((group) => <div key={group.title}><h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.title}</h3><div className="mt-3 grid gap-4 md:grid-cols-2">{group.fields.map((field) => field.multiline ? <Textarea key={field.key} label={field.label} value={fields[field.key]} onChange={(value) => updateField(field.key, value)} /> : <Field key={field.key} label={field.label} value={fields[field.key]} onChange={(value) => updateField(field.key, value)} />)}</div></div>)}</div>
          <div className="mt-6"><h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Acheteurs et vendeurs détectés</h3><div className="mt-3 space-y-3">{parties.length ? parties.map((party, index) => { const duplicate = contactDuplicates[index]; return <div key={index} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{party.firstName} {party.lastName}</p>{party.roles.map((role) => <span key={role} className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-200">{roleLabel(role)}</span>)}</div><p className="mt-1 text-xs text-slate-500">{party.email || party.phone || party.mailingAddress || "Coordonnées non trouvées"}</p>{duplicate ? <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-semibold">Contact existant trouvé : {duplicate.name}</p><p className="mt-1 text-xs">Les nouveaux rôles seront ajoutés à la fiche existante.</p><div className="mt-2 flex flex-wrap gap-2">{(["merge", "update", "create"] as DuplicateDecision[]).map((decision) => <button key={decision} type="button" onClick={() => setContactDecisions((current) => ({ ...current, [index]: decision }))} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", contactDecisions[index] === decision ? "border-amber-700 bg-amber-700 text-white" : "border-amber-400")}>{decision === "merge" ? "Fusionner" : decision === "update" ? "Mettre à jour" : "Créer quand même"}</button>)}</div></div> : <p className="mt-2 text-xs font-semibold text-teal-700">Nouvelle fiche client multirôle</p>}</div>}) : <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucun acheteur ou vendeur clairement identifié dans les documents.</p>}</div></div>
          {existingProperty ? <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-semibold">Propriété existante trouvée : {String(existingProperty.address || "")}, {String(existingProperty.city || "")}</p><div className="mt-3 flex flex-wrap gap-2">{(["merge", "update", "create"] as DuplicateDecision[]).map((decision) => <button key={decision} type="button" onClick={() => setPropertyDecision(decision)} className={cn("rounded-lg border px-3 py-2 font-semibold", propertyDecision === decision ? "border-amber-700 bg-amber-700 text-white" : "border-amber-400")}>{decision === "merge" ? "Fusionner" : decision === "update" ? "Mettre à jour" : "Créer quand même"}</button>)}</div></div> : null}
          <button type="button" onClick={validateAndCreate} disabled={!fields.address.trim() || !fields.city.trim()} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"><Home className="h-4 w-4" />Valider et créer le dossier</button>
        </> : <p className="mt-8 rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800">Déposez les documents pour commencer l’analyse structurée.</p>}
      </section>
    </div>
  );
}

function Summary({ files, sellers, existingContacts, propertyExists, found, missing }: { files: number; sellers: number; existingContacts: number; propertyExists: boolean; found: number; missing: string[] }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold">Résumé avant validation</h3><div className="mt-3 grid grid-cols-2 gap-2"><p>Documents analysés : <strong>{files}</strong></p><p>Contacts identifiés : <strong>{sellers}</strong></p><p>Contacts existants : <strong>{existingContacts}</strong></p><p>Nouvelle propriété : <strong>{propertyExists ? "non" : "oui"}</strong></p><p>Informations trouvées : <strong>{found}</strong></p><p>Informations manquantes : <strong>{missing.length}</strong></p></div>{missing.length ? <ul className="mt-3 text-slate-500">{missing.map((item) => <li key={item}>□ {item}</li>)}</ul> : null}</div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium">{label}</span><textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>;
}

function normalizedParties(fields: ExtractedMandateFields): ExtractedParty[] {
  const fallbackSellers = fields.sellers.length ? fields.sellers : fields.owners.split(/\s+(?:et|&)\s+|[,;]/i).map((name) => {
    const parts = name.trim().split(/\s+/);
    return { firstName: parts[0] || "", lastName: parts.slice(1).join(" "), mailingAddress: "", phone: "", email: "", roles: ["seller", "owner"] as ContactRole[] };
  }).filter((person) => person.firstName || person.lastName);
  const input: ExtractedParty[] = [
    ...fallbackSellers.map((person) => ({ ...person, roles: uniqueRoles([...(person.roles || []), "seller", "owner"]) })),
    ...fields.buyers.map((person) => ({ ...person, roles: uniqueRoles([...(person.roles || []), "buyer"]) })),
  ];
  const merged: ExtractedParty[] = [];
  input.forEach((person) => {
    const currentIndex = merged.findIndex((current) =>
      (person.email && current.email && normalizeText(person.email) === normalizeText(current.email)) ||
      (person.phone && current.phone && normalizePhone(person.phone) === normalizePhone(current.phone)) ||
      normalizeText(`${person.firstName} ${person.lastName}`) === normalizeText(`${current.firstName} ${current.lastName}`)
    );
    if (currentIndex < 0) {
      merged.push(person);
      return;
    }
    const current = merged[currentIndex];
    if (!current) return;
    merged[currentIndex] = {
      firstName: current.firstName || person.firstName,
      lastName: current.lastName || person.lastName,
      mailingAddress: current.mailingAddress || person.mailingAddress,
      phone: current.phone || person.phone,
      email: current.email || person.email,
      roles: uniqueRoles([...current.roles, ...person.roles]),
    };
  });
  return merged;
}

function uniqueRoles(roles: ContactRole[]) {
  return [...new Set(roles)];
}

function roleLabel(role: ContactRole) {
  return role === "buyer" ? "Acheteur" : role === "seller" ? "Vendeur" : role === "investor" ? "Investisseur" : "Propriétaire";
}

function roleSummary(parties: ExtractedParty[]) {
  const roles = uniqueRoles(parties.flatMap((party) => party.roles));
  return roles.length ? roles.map(roleLabel).join(", ") : "rôle à confirmer";
}

function normalizePhone(value?: string) { return (value || "").replace(/\D/g, ""); }
function normalizeText(value?: string) { return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }

function findContactDuplicate(contacts: SoniaProspect[], person: ExtractedParty) {
  const phone = normalizePhone(person.phone);
  const email = normalizeText(person.email);
  const name = normalizeText(`${person.firstName} ${person.lastName}`);
  return contacts.find((contact) => (phone && normalizePhone(contact.phone) === phone) || (email && normalizeText(contact.email) === email) || normalizeText(contact.name) === name) || null;
}

function rolesFromExisting(contact?: SoniaProspect | null): ContactRole[] {
  const relationship = contact?.importProfile?.relationshipType;
  if (relationship === "both") return ["buyer", "seller"];
  if (relationship === "buyer") return ["buyer"];
  if (relationship === "investor") return ["investor", "owner"];
  if (relationship === "seller") return ["seller", "owner"];
  return [];
}

function relationshipFromRoles(roles: ContactRole[]): ClientRelationshipType {
  if (roles.includes("buyer") && roles.includes("seller")) return "both";
  if (roles.includes("investor")) return "investor";
  if (roles.includes("buyer")) return "buyer";
  return "seller";
}

function contactFromParty(person: ExtractedParty, existing?: SoniaProspect | null, overwrite = false): SoniaProspect {
  const now = new Date().toISOString();
  const choose = (oldValue: string | undefined, newValue: string) => overwrite ? newValue || oldValue : oldValue || newValue;
  const roles = uniqueRoles([...rolesFromExisting(existing), ...person.roles]);
  const relationshipType = relationshipFromRoles(roles);
  const clientType = roles.includes("buyer") && !roles.includes("seller") ? "buyer" : "seller";
  const name = `${person.firstName} ${person.lastName}`.trim() || existing?.name || "Client";
  return {
    id: existing?.id || `document-client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: choose(existing?.name, name) || name,
    phone: choose(existing?.phone, person.phone) || undefined,
    email: choose(existing?.email, person.email) || undefined,
    address: choose(existing?.address, person.mailingAddress) || "",
    city: existing?.city || "",
    clientType,
    source: existing?.source || "Pipeline",
    status: existing?.status || (clientType === "buyer" ? officialBuyerWorkflow[0] : officialSellerWorkflow[1]),
    notes: [existing?.notes, "Source : documents du dossier immobilier", `Rôles : ${roles.map(roleLabel).join(", ")}`].filter(Boolean).join("\n"),
    nextAction: existing?.nextAction || (roles.includes("seller") ? "Valider le dossier et préparer la mise en marché" : "Qualifier le projet d’achat"),
    nextActionDate: existing?.nextActionDate || new Date().toISOString().slice(0, 10),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    history: [{ id: `document-${Date.now()}`, date: now, title: existing ? "Fiche multirôle reliée au dossier" : "Client créé depuis les documents", description: `Rôles reconnus : ${roles.map(roleLabel).join(", ")}.`, type: "status" }, ...(existing?.history || [])],
    importProfile: {
      ...(existing?.importProfile || { relationshipType, communicationConsent: false, automationEligible: [], missingInformation: [] }),
      firstName: person.firstName || existing?.importProfile?.firstName,
      lastName: person.lastName || existing?.importProfile?.lastName,
      relationshipType,
      communicationConsent: existing?.importProfile?.communicationConsent || false,
      automationEligible: existing?.importProfile?.automationEligible || [],
      missingInformation: [!person.email && !existing?.email ? "courriel" : "", !person.phone && !existing?.phone ? "téléphone" : ""].filter(Boolean),
    },
  };
}

function propertyPayload(id: string, fields: ExtractedMandateFields, fileNames: string[], partyLinks: Array<{ contactId: string; roles: ContactRole[] }>) {
  return {
    id, address: fields.address, city: fields.city, postal_code: fields.postalCode, property_type: fields.propertyType || "Propriété",
    transaction_type: fields.transactionType, asking_price: fields.askingPrice, bedrooms: fields.bedrooms, bathrooms: fields.bathrooms, garage: fields.garage,
    parking: fields.parking, pool: fields.pool, fireplace: fields.fireplace, living_area: fields.livingArea,
    land_area: fields.landArea, dimensions: fields.dimensions, year_built: fields.yearBuilt, lot_number: fields.lotNumber,
    cadastre: fields.cadastre, municipal_taxes: fields.municipalTaxes, school_taxes: fields.schoolTaxes,
    municipal_assessment: fields.municipalAssessment, zoning: fields.zoning, servitudes: fields.servitudes,
    mortgage: { lender: fields.mortgageLender, date: fields.mortgageDate, amount: fields.mortgageAmount, maturity: fields.mortgageMaturity },
    market_date: fields.marketDate, availability: fields.availability, description: fields.importantInfo,
    missing_info: fields.missingInfo, extracted_document_names: fileNames, party_links: partyLinks,
    owner_contact_ids: partyLinks.filter((link) => link.roles.includes("seller") || link.roles.includes("owner")).map((link) => link.contactId),
    buyer_contact_ids: partyLinks.filter((link) => link.roles.includes("buyer")).map((link) => link.contactId),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

function mergeProperty(existing: ExistingProperty, extracted: Record<string, unknown>, overwrite: boolean) {
  const next: Record<string, unknown> = { ...existing };
  Object.entries(extracted).forEach(([key, value]) => {
    const hasValue = value !== "" && value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0);
    if (hasValue && (overwrite || !next[key])) next[key] = value;
  });
  next.updated_at = new Date().toISOString();
  return next;
}

function findExistingProperty(address: string, city: string): ExistingProperty | null {
  if (typeof window === "undefined" || !address.trim()) return null;
  const key = `${normalizeText(address)}|${normalizeText(city)}`;
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey?.startsWith("iacourtier-mandate-")) continue;
    try {
      const property = JSON.parse(window.localStorage.getItem(storageKey) || "{}") as ExistingProperty;
      if (`${normalizeText(property.address)}|${normalizeText(property.city)}` === key) return property;
    } catch { /* ignore invalid local records */ }
  }
  return null;
}
