"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  MISSING_DATA_LABELS,
  getCollectionRequestByToken,
  submitCollectionResponse,
  type CollectionResponse,
  type MissingDataField,
} from "@/lib/client-data-collection";

type PublicRequest = ReturnType<typeof getCollectionRequestByToken>;

export default function ClientInformationPage({ params }: { params: { token: string } }) {
  const [request, setRequest] = useState<PublicRequest>(null);
  const [loaded, setLoaded] = useState(false);
  const [response, setResponse] = useState<CollectionResponse>({ interests: [] });
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setRequest(getCollectionRequestByToken(params.token));
    setLoaded(true);
  }, [params.token]);

  function update<K extends keyof CollectionResponse>(field: K, value: CollectionResponse[K]) {
    setResponse((current) => ({ ...current, [field]: value }));
  }

  function toggleInterest(value: string) {
    const interests = response.interests || [];
    update("interests", interests.includes(value) ? interests.filter((item) => item !== value) : [...interests, value]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      submitCollectionResponse(params.token, response);
      setCompleted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer la réponse.");
    }
  }

  if (!loaded) return <main className="mx-auto max-w-2xl p-6">Chargement…</main>;
  if (!request) return <StateMessage title="Lien invalide" text="Cette demande n’existe pas ou n’est plus disponible." />;
  if (request.expired) return <StateMessage title="Lien expiré" text="Communiquez avec votre courtier pour obtenir un nouveau lien." />;
  if (request.completed || completed) return <StateMessage title="Merci!" text="Vos renseignements ont été enregistrés et votre fiche a été mise à jour." />;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <form onSubmit={submit} className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">IACourtier</p>
        <h1 className="mt-2 text-3xl font-semibold">Bonjour {request.firstName}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Ces quelques renseignements permettront à votre courtier de vous accompagner au bon moment. Répondez seulement aux questions affichées; aucune obligation et aucun solde hypothécaire demandé.</p>

        <div className="mt-7 space-y-6">
          {request.fields.includes("mortgageRenewal") ? (
            <FieldGroup label="Quand votre hypothèque arrive-t-elle à renouvellement?">
              <div className="grid gap-3 sm:grid-cols-2">
                <select required value={response.mortgageMonth || ""} onChange={(event) => update("mortgageMonth", event.target.value)} className={inputClass}>
                  <option value="">Mois</option>
                  {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleDateString("fr-CA", { month: "long" })}</option>)}
                </select>
                <input required type="number" min={new Date().getFullYear()} max={new Date().getFullYear() + 40} placeholder="Année" value={response.mortgageYear || ""} onChange={(event) => update("mortgageYear", event.target.value)} className={inputClass} />
              </div>
              <input placeholder="Institution financière (facultatif)" value={response.lender || ""} onChange={(event) => update("lender", event.target.value)} className={inputClass} />
              <RadioQuestion label="Souhaitez-vous être mis en contact avec un partenaire hypothécaire?" value={response.mortgagePartnerInterest} onChange={(value) => update("mortgagePartnerInterest", value)} />
            </FieldGroup>
          ) : null}

          {request.fields.includes("birthDate") ? <DateField label="Date de naissance" value={response.birthDate} onChange={(value) => update("birthDate", value)} /> : null}
          {request.fields.includes("transactionDate") ? <DateField label="Date de transaction" value={response.transactionDate} onChange={(value) => update("transactionDate", value)} /> : null}
          {request.fields.includes("address") ? <TextField label="Adresse actuelle" value={response.address} onChange={(value) => update("address", value)} /> : null}
          {request.fields.includes("projectType") ? <TextField label="Quel est votre type de projet immobilier?" value={response.projectType} onChange={(value) => update("projectType", value)} placeholder="Vendre, acheter, investir, refinancer…" /> : null}
          {request.fields.includes("lender") && !request.fields.includes("mortgageRenewal") ? <TextField label="Institution financière (facultatif)" value={response.lender} onChange={(value) => update("lender", value)} required={false} /> : null}
          {request.fields.includes("communicationConsent") ? <RadioQuestion label="Acceptez-vous de recevoir des communications utiles de votre courtier?" value={response.communicationConsent} onChange={(value) => update("communicationConsent", value)} /> : null}
          {request.fields.includes("interests") ? (
            <FieldGroup label="Quels sujets vous intéressent?">
              <div className="grid gap-2 sm:grid-cols-2">
                {["Vendre", "Acheter", "Investir", "Refinancer"].map((interest) => (
                  <label key={interest} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                    <input type="checkbox" checked={response.interests?.includes(interest) || false} onChange={() => toggleInterest(interest)} />
                    {interest}
                  </label>
                ))}
              </div>
            </FieldGroup>
          ) : null}
        </div>

        {error ? <p className="mt-5 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <button type="submit" className="mt-7 w-full rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">Envoyer mes réponses</button>
        <p className="mt-3 text-center text-xs text-slate-500">Lien unique et temporaire. Seuls les renseignements saisis sont conservés.</p>
      </form>
    </main>
  );
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950";

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return <fieldset className="space-y-3"><legend className="text-sm font-semibold">{label}</legend>{children}</fieldset>;
}
function TextField({ label, value, onChange, placeholder, required = true }: { label: string; value?: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <label className="block text-sm font-semibold">{label}<input required={required} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`mt-2 ${inputClass}`} /></label>;
}
function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold">{label}<input required type="date" value={value || ""} onChange={(event) => onChange(event.target.value)} className={`mt-2 ${inputClass}`} /></label>;
}
function RadioQuestion({ label, value, onChange }: { label: string; value?: "yes" | "no"; onChange: (value: "yes" | "no") => void }) {
  return <fieldset><legend className="text-sm font-semibold">{label}</legend><div className="mt-2 flex gap-4">{["yes", "no"].map((choice) => <label key={choice} className="flex items-center gap-2 text-sm"><input required type="radio" name={label} checked={value === choice} onChange={() => onChange(choice as "yes" | "no")} />{choice === "yes" ? "Oui" : "Non"}</label>)}</div></fieldset>;
}
function StateMessage({ title, text }: { title: string; text: string }) {
  return <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950"><div className="mx-auto mt-20 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{text}</p></div></main>;
}
