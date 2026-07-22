"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, FileText, UploadCloud } from "lucide-react";

import { buildBuyerGuideExample, loadBrokerProfile } from "@/lib/broker-profile";
import { getCoachJourney } from "@/lib/coach-journeys";
import { getSoniaProspects, upsertSoniaProspect } from "@/lib/sonia-beta/storage";
import type { SoniaProspect } from "@/lib/sonia-beta/types";

export function IntelligentJourney({ slug }: { slug: string }) {
  const journey = getCoachJourney(slug);
  const [clientMode, setClientMode] = useState<"new" | "existing">("new");
  const [existingId, setExistingId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const contacts = useMemo(() => getSoniaProspects().filter((item) => !item.id.startsWith("sonia-demo-")), []);
  const brokerProfile = useMemo(() => loadBrokerProfile(), []);

  if (!journey) return <section className="rounded-2xl border border-subtle bg-surface p-6"><h1 className="text-2xl font-semibold">Parcours introuvable</h1><Link href="/tableau-de-bord" className="mt-4 inline-block text-electric-500">Retourner au Coach IA</Link></section>;

  const isBuyer = journey.slug === "dossier-acheteur";
  const isSeller = journey.slug === "mandat-vendeur";

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    let contact: SoniaProspect | undefined;
    if (clientMode === "existing") {
      contact = contacts.find((item) => item.id === existingId);
      if (!contact) return setError("Choisis un client existant.");
    } else if (isBuyer || journey.slug === "achat-vente") {
      if (!name.trim()) return setError("Le nom du client est requis.");
      const duplicate = contacts.find((item) =>
        (email && item.email?.toLowerCase() === email.toLowerCase()) ||
        item.name.trim().toLowerCase() === name.trim().toLowerCase(),
      );
      if (duplicate) return setError(`Ce contact semble déjà exister : ${duplicate.name}. Choisis « Client existant » pour continuer sans créer de doublon.`);
      const now = new Date().toISOString();
      const both = journey.slug === "achat-vente";
      contact = {
        id: `journey-${Date.now()}`, name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined,
        address: "", city: "", clientType: "buyer", source: "Pipeline", status: "Qualification acheteur",
        notes: both ? "Rôles : Acheteur, Vendeur" : "Rôle : Acheteur",
        nextAction: "Compléter la qualification acheteur", nextActionDate: now.slice(0, 10), createdAt: now, updatedAt: now,
        history: [{ id: `journey-history-${Date.now()}`, date: now, title: journey.title, description: `Parcours créé par le Coach IA. Documents reçus : ${files.length}.`, type: "ai" }],
        importProfile: {
          firstName: name.trim().split(/\s+/)[0], lastName: name.trim().split(/\s+/).slice(1).join(" "),
          relationshipType: both ? "both" : "buyer", communicationConsent: false,
          automationEligible: journey.recommendedAutomations, missingInformation: journey.missingFields.filter((field) => !values[field]),
          projectType: journey.title,
        },
      };
      upsertSoniaProspect(contact);
    }

    const record = {
      id: `coach-journey-${Date.now()}`, slug: journey.slug, title: journey.title, contactId: contact?.id || null,
      files, values, createdItems: journey.createdItems, recommendedAutomations: journey.recommendedAutomations,
      guide: isBuyer ? buildBuyerGuideExample(brokerProfile) : null, createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(`iacourtier-journey-${record.id}`, JSON.stringify(record));
    setCreated(true);
  }

  if (created) {
    const missing = journey.missingFields.filter((field) => !values[field]);
    return <section className="rounded-2xl border border-electric-500/30 bg-surface p-6"><p className="text-sm font-semibold text-electric-500">Coach IA</p><h1 className="mt-2 text-3xl font-semibold">{journey.title} prêt</h1><p className="mt-4 text-sm leading-7 text-muted">J’ai préparé {journey.createdItems.join(", ")}. {journey.recommendedAutomations.length} automatisation{journey.recommendedAutomations.length > 1 ? "s" : ""} recommandée{journey.recommendedAutomations.length > 1 ? "s" : ""} sont prêtes à être validées.</p>{missing.length ? <div className="mt-5 rounded-xl bg-background p-4"><p className="font-semibold">Il manque seulement :</p><ul className="mt-2 space-y-1 text-sm text-muted">{missing.map((item) => <li key={item}>• {item}</li>)}</ul></div> : null}{isBuyer ? <details className="mt-5 rounded-xl border border-subtle p-4"><summary className="cursor-pointer font-semibold">Guide Acheteur personnalisé</summary><pre className="mt-4 whitespace-pre-wrap text-sm leading-6">{buildBuyerGuideExample(brokerProfile)}</pre></details> : null}<Link href="/tableau-de-bord" className="mt-6 inline-flex rounded-full bg-electric-500 px-5 py-3 font-semibold text-white">Retourner au Coach IA</Link></section>;
  }

  return <form onSubmit={submit} className="space-y-6">
    <section className="rounded-2xl border border-subtle bg-surface p-6"><p className="text-sm font-semibold text-electric-500">Parcours choisi par le Coach IA</p><h1 className="mt-2 text-3xl font-semibold">{journey.icon} {journey.title}</h1><p className="mt-3 text-muted">{journey.summary}</p></section>

    {(isBuyer || journey.slug === "achat-vente") ? <section className="rounded-2xl border border-subtle bg-surface p-6"><h2 className="text-xl font-semibold">1. Le client existe-t-il?</h2><div className="mt-4 flex flex-wrap gap-3">{(["new", "existing"] as const).map((mode) => <button key={mode} type="button" onClick={() => setClientMode(mode)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${clientMode === mode ? "border-electric-500 bg-electric-500 text-white" : "border-subtle"}`}>{mode === "new" ? "Nouveau client" : "Client existant"}</button>)}</div>{clientMode === "existing" ? <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className="mt-4 min-h-11 w-full rounded-xl border border-subtle bg-background px-4"><option value="">Choisir un client</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : <div className="mt-4 grid gap-3 md:grid-cols-3"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet *" className="rounded-xl border border-subtle bg-background px-4 py-3" /><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Courriel" type="email" className="rounded-xl border border-subtle bg-background px-4 py-3" /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" type="tel" className="rounded-xl border border-subtle bg-background px-4 py-3" /></div>}</section> : null}

    <section className="rounded-2xl border border-subtle bg-surface p-6"><h2 className="text-xl font-semibold">{isBuyer || journey.slug === "achat-vente" ? "2." : "1."} Documents disponibles</h2><p className="mt-2 text-sm text-muted">{journey.documents.length ? journey.documents.join(" · ") : "Aucun document requis pour démarrer ce parcours."}</p>{journey.documents.length ? <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-subtle bg-background p-5"><UploadCloud className="h-6 w-6 text-electric-500" /><span className="text-sm font-semibold">Déposer les documents disponibles</span><input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []).map((file) => file.name))} /></label> : null}{files.length ? <div className="mt-3 flex flex-wrap gap-2">{files.map((file) => <span key={file} className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs"><FileText className="h-3 w-3" />{file}</span>)}</div> : <p className="mt-3 text-xs text-muted">Tu peux continuer sans document.</p>}</section>

    <section className="rounded-2xl border border-subtle bg-surface p-6"><h2 className="text-xl font-semibold">{isBuyer || journey.slug === "achat-vente" ? "3." : "2."} Informations connues</h2><p className="mt-2 text-sm text-muted">Remplis seulement ce que tu connais. Le Coach conservera le reste comme information à compléter.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{journey.missingFields.map((field) => <label key={field}><span className="mb-1 block text-sm font-medium">{field}</span><input value={values[field] || ""} onChange={(e) => setValues((current) => ({ ...current, [field]: e.target.value }))} className="min-h-11 w-full rounded-xl border border-subtle bg-background px-4" /></label>)}</div></section>

    {isSeller ? <Link href="/tableau-de-bord/mandats/nouveau?type=seller" className="inline-flex min-h-12 items-center rounded-full border border-electric-500 px-5 font-semibold text-electric-500">Analyser les documents vendeur</Link> : null}
    {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-electric-500 px-6 font-semibold text-white"><Check className="h-4 w-4" />Créer ce parcours</button>
  </form>;
}
