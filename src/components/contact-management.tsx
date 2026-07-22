"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { saveSoniaProspects, upsertSoniaProspect } from "@/lib/sonia-beta/storage";
import type { ClientRelationshipType, SoniaProspect } from "@/lib/sonia-beta/types";
import { officialBuyerWorkflow, officialSellerWorkflow } from "@/lib/business-rules";

type ContactForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  address: string;
  city: string;
  postalCode: string;
  classification: string;
  source: string;
  notes: string;
  consent: boolean;
  doNotContact: boolean;
};

const emptyForm: ContactForm = {
  firstName: "", lastName: "", phone: "", email: "", birthDate: "", address: "", city: "", postalCode: "",
  classification: "prospect", source: "Référence", notes: "", consent: false, doNotContact: false,
};

const classifications = [
  ["prospect", "Prospect"], ["buyer", "Acheteur"], ["seller", "Vendeur"], ["both", "Acheteur/Vendeur"],
  ["client", "Client"], ["former", "Ancien client"], ["partner", "Partenaire"], ["investor", "Investisseur"], ["other", "Autre"],
];

const sources = ["Référence", "Facebook", "Google", "Site web", "Appel entrant", "Visite libre", "Pancarte", "Publicité", "Organique", "Autre"];

export function ContactManagement({
  contacts,
  editingContact,
  onChanged,
  onEditingClosed,
}: {
  contacts: SoniaProspect[];
  editingContact: SoniaProspect | null;
  onChanged: () => void;
  onEditingClosed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<SoniaProspect | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [duplicate, setDuplicate] = useState<SoniaProspect | null>(null);
  const [coachMessage, setCoachMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingContact) return;
    openEditor(editingContact);
  }, [editingContact]);

  function openEditor(contact?: SoniaProspect) {
    setCurrent(contact || null);
    setForm(contact ? formFromContact(contact) : emptyForm);
    setDuplicate(null);
    setCoachMessage("");
    setError("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setCurrent(null);
    setDuplicate(null);
    setError("");
    onEditingClosed();
  }

  function update<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setDuplicate(null);
    setError("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Le prénom et le nom sont obligatoires.");
      return;
    }
    const match = findDuplicate(contacts, form, current?.id);
    if (match) {
      setDuplicate(match);
      return;
    }
    persist("create");
  }

  function persist(mode: "create" | "force" | "merge") {
    const now = new Date().toISOString();
    const target = mode === "merge" ? duplicate : current;
    const id = target?.id || `manual-contact-${Date.now()}`;
    const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const relationshipType = relationshipValue(form.classification);
    const clientType = form.classification === "buyer" ? "buyer" : "seller";
    const doNotContactNote = form.doNotContact ? "Ne plus contacter" : "";
    const sourceNote = `Source de contact : ${form.source}`;
    const classificationNote = `Classification : ${classificationLabel(form.classification)}`;
    const notes = [mode === "merge" ? target?.notes : "", sourceNote, classificationNote, form.notes.trim(), doNotContactNote].filter(Boolean).join("\n");
    const profile = {
      ...(target?.importProfile || {
        relationshipType,
        communicationConsent: false,
        automationEligible: [],
        missingInformation: [],
      }),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      postalCode: form.postalCode.trim() || undefined,
      relationshipType,
      birthDate: form.birthDate || undefined,
      communicationConsent: form.consent && !form.doNotContact,
      communicationConsentAnsweredAt: now,
      automationEligible: form.birthDate && form.consent && !form.doNotContact ? ["Anniversaire"] : [],
      missingInformation: [
        !form.email.trim() ? "courriel" : "",
        !form.phone.trim() ? "téléphone" : "",
        !form.birthDate ? "date de naissance" : "",
      ].filter(Boolean),
    };
    const contact: SoniaProspect = {
      id,
      name: mode === "merge" && target?.name ? target.name : name,
      phone: mode === "merge" ? target?.phone || form.phone.trim() || undefined : form.phone.trim() || undefined,
      email: mode === "merge" ? target?.email || form.email.trim() || undefined : form.email.trim() || undefined,
      address: mode === "merge" ? target?.address || form.address.trim() : form.address.trim(),
      city: mode === "merge" ? target?.city || form.city.trim() : form.city.trim(),
      clientType: target?.clientType || clientType,
      source: target?.source || "Manuel",
      status: target?.status || (clientType === "buyer" ? officialBuyerWorkflow[0] : officialSellerWorkflow[1]),
      notes,
      nextAction: target?.nextAction || "Préparer un premier appel",
      nextActionDate: target?.nextActionDate || addDays(2),
      createdAt: target?.createdAt || now,
      updatedAt: now,
      history: [
        {
          id: `contact-${mode}-${Date.now()}`,
          date: now,
          title: mode === "merge" ? "Contact fusionné" : current ? "Contact modifié" : "Contact créé manuellement",
          description: mode === "merge" ? "Les données manquantes de la fiche existante ont été complétées." : current ? "Les informations de la fiche ont été mises à jour." : "Contact ajouté sans import CSV.",
          type: "status",
        },
        ...(target?.history || []),
      ],
      importProfile: profile,
    };
    upsertSoniaProspect(contact);
    setCoachMessage(buildCoachMessage(contact));
    setDuplicate(null);
    onChanged();
    if (mode === "merge") setCurrent(contact);
  }

  function remove() {
    if (!current) return;
    if (!window.confirm(`Supprimer définitivement ${current.name}? Cette action ne peut pas être annulée.`)) return;
    saveSoniaProspects(contacts.filter((contact) => contact.id !== current.id));
    onChanged();
    close();
  }

  return (
    <>
      <button type="button" onClick={() => openEditor()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800">
        <Plus className="h-4 w-4" /> Ajouter un contact
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-slate-950/55 p-0 sm:p-6">
          <div className="mx-auto min-h-full w-full max-w-3xl bg-white p-4 shadow-2xl dark:bg-slate-900 sm:min-h-0 sm:rounded-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold text-teal-700">Gestion des contacts</p><h2 className="mt-1 text-2xl font-semibold">{current ? "Modifier le contact" : "Ajouter un contact"}</h2><p className="mt-1 text-xs text-slate-500">Les champs marqués * sont obligatoires.</p></div>
              <button type="button" onClick={close} aria-label="Fermer" className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submit} className="mt-6 space-y-6">
              <FormSection title="Informations principales">
                <Field label="Prénom *"><input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputClass} /></Field>
                <Field label="Nom *"><input required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={inputClass} /></Field>
                <Field label="Téléphone"><input type="tel" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} /></Field>
                <Field label="Courriel"><input type="email" inputMode="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} /></Field>
                <Field label="Date de naissance"><input type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} className={inputClass} /></Field>
              </FormSection>
              <FormSection title="Adresse">
                <Field label="Adresse"><input value={form.address} onChange={(e) => update("address", e.target.value)} className={inputClass} /></Field>
                <Field label="Ville"><input value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass} /></Field>
                <Field label="Code postal"><input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} className={inputClass} /></Field>
              </FormSection>
              <FormSection title="Classification">
                <Field label="Type"><select value={form.classification} onChange={(e) => update("classification", e.target.value)} className={inputClass}>{classifications.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Source"><select value={form.source} onChange={(e) => update("source", e.target.value)} className={inputClass}>{sources.map((source) => <option key={source}>{source}</option>)}</select></Field>
              </FormSection>
              <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} className={inputClass} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} /> Consentement aux communications</label>
                <label className="flex min-h-12 items-center gap-3 rounded-lg border border-red-200 p-3 text-sm text-red-700 dark:border-red-900"><input type="checkbox" checked={form.doNotContact} onChange={(e) => update("doNotContact", e.target.checked)} /> Ne plus contacter</label>
              </div>
              {duplicate ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-semibold">Ce contact semble déjà exister.</p><p className="mt-1">{duplicate.name} · {duplicate.email || duplicate.phone || "coordonnées partielles"}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openEditor(duplicate)} className="rounded-lg border border-amber-400 px-3 py-2 font-semibold">Ouvrir la fiche existante</button><button type="button" onClick={() => persist("merge")} className="rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white">Fusionner</button><button type="button" onClick={() => persist("force")} className="rounded-lg border border-amber-400 px-3 py-2 font-semibold">Créer quand même</button></div></div> : null}
              {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p> : null}
              {coachMessage ? <div className="whitespace-pre-line rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100"><strong>Coach IA</strong>{"\n"}{coachMessage}</div> : null}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-between dark:border-slate-800">
                {current ? <button type="button" onClick={remove} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-3 text-sm font-semibold text-red-700"><Trash2 className="h-4 w-4" /> Supprimer</button> : <span />}
                <div className="flex flex-col gap-3 sm:flex-row"><button type="button" onClick={close} className="min-h-12 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold">Annuler</button><button type="submit" className="min-h-12 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">{current ? "Enregistrer les modifications" : "Enregistrer le contact"}</button></div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

const inputClass = "mt-1 min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold">{label}{children}</label>;
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset><legend className="text-sm font-semibold text-teal-700">{title}</legend><div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div></fieldset>;
}

function normalized(value?: string) {
  return (value || "").toLowerCase().replace(/\D/g, "");
}

function textKey(value?: string) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function findDuplicate(contacts: SoniaProspect[], form: ContactForm, excludedId?: string) {
  const phone = normalized(form.phone);
  const email = textKey(form.email);
  const name = textKey(`${form.firstName} ${form.lastName}`);
  return contacts.find((contact) => contact.id !== excludedId && (
    (phone && normalized(contact.phone) === phone) ||
    (email && textKey(contact.email) === email) ||
    textKey(contact.name) === name
  )) || null;
}

function relationshipValue(value: string): ClientRelationshipType {
  if (value === "buyer" || value === "seller" || value === "both" || value === "former" || value === "partner" || value === "investor" || value === "prospect") return value;
  return "other";
}

function classificationLabel(value: string) {
  return classifications.find(([id]) => id === value)?.[1] || "Autre";
}

function extractNote(notes: string, label: string) {
  return notes.split("\n").find((line) => line.toLowerCase().startsWith(label.toLowerCase()))?.split(":").slice(1).join(":").trim() || "";
}

function formFromContact(contact: SoniaProspect): ContactForm {
  const profile = contact.importProfile;
  const names = contact.name.trim().split(/\s+/);
  const classification = extractNote(contact.notes, "Classification") || profile?.relationshipType || "prospect";
  const match = classifications.find(([, label]) => textKey(label) === textKey(classification));
  return {
    firstName: profile?.firstName || names[0] || "",
    lastName: profile?.lastName || names.slice(1).join(" "),
    phone: contact.phone || "",
    email: contact.email || "",
    birthDate: profile?.birthDate || "",
    address: contact.address || "",
    city: contact.city || "",
    postalCode: profile?.postalCode || "",
    classification: match?.[0] || (classifications.some(([id]) => id === classification) ? classification : "other"),
    source: extractNote(contact.notes, "Source de contact") || contact.source,
    notes: contact.notes.split("\n").filter((line) => !/^(Source de contact|Classification)\s*:/i.test(line) && !/^Ne plus contacter$/i.test(line.trim())).join("\n").trim(),
    consent: Boolean(profile?.communicationConsent),
    doNotContact: /ne plus contacter/i.test([contact.notes, contact.nextAction].join(" ")),
  };
}

function buildCoachMessage(contact: SoniaProspect) {
  const strengths = [contact.phone ? "un numéro de téléphone" : "", contact.email ? "une adresse courriel" : ""].filter(Boolean);
  return [
    `Ce prospect possède ${strengths.length ? strengths.join(" et ") : "des coordonnées à compléter"}.`,
    "",
    "Je recommande :",
    "• préparer un premier appel",
    "• planifier un suivi dans 48 heures",
    contact.email && contact.importProfile?.communicationConsent ? "• ajouter une campagne de bienvenue" : "• confirmer le consentement avant une campagne de bienvenue",
    contact.importProfile?.birthDate ? "L’automatisation des anniversaires sera disponible pour ce contact." : "",
  ].filter((line) => line !== "").join("\n");
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
