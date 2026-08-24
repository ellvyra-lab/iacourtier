"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Contact, FileText, Loader2, MessageSquareText, PenLine, UploadCloud, WalletCards } from "lucide-react";

import type { MandateDocumentExtractionResponse } from "@/lib/mandate-document-extraction";
import type { BuyerContactInput, BuyerCriteriaInput, BuyerSource } from "@/lib/buyer-cases";
import { SessionStatusNotice, useDashboardAuth } from "@/components/auth/DashboardAuthProvider";

type Mode = "choice" | "manual" | "message" | "identity" | "preapproval" | "document" | "review";

const emptyContact: BuyerContactInput = { firstName: "", lastName: "", email: "", phone: "", mailingAddress: "" };
const emptyCriteria: BuyerCriteriaInput = { budget: "", preapprovalStatus: "missing", sectors: [], propertyType: "", bedrooms: "", importantNeeds: "", timeline: "", propertyToSell: null };

export function NewBuyerCase() {
  const router = useRouter();
  const { status: authStatus, authenticatedFetch } = useDashboardAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("choice");
  const [source, setSource] = useState<BuyerSource>("manual");
  const [contact, setContact] = useState<BuyerContactInput>(emptyContact);
  const [criteria, setCriteria] = useState<BuyerCriteriaInput>(emptyCriteria);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const missing = useMemo(() => [
    !criteria.budget && "budget",
    criteria.preapprovalStatus === "missing" && "préapprobation",
    !criteria.sectors.length && "secteurs",
    !criteria.propertyType && "type de propriété",
    !criteria.bedrooms && "chambres",
    !criteria.importantNeeds && "besoins importants",
    !criteria.timeline && "échéancier",
    criteria.propertyToSell === null && "propriété actuelle à vendre ou non",
  ].filter(Boolean) as string[], [criteria]);

  function start(nextMode: Exclude<Mode, "choice" | "review">, nextSource: BuyerSource) {
    setMode(nextMode);
    setSource(nextSource);
    setError("");
    setNotice("");
  }

  function parseMessage() {
    const email = message.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || "";
    const phone = message.match(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/)?.[0] || "";
    const firstSentence = message.split(/[,.\n]/)[0]?.trim() || "";
    const nameMatch = firstSentence.match(/(?:client(?:e)?|acheteur|acheteuse)?\s*(?:s['’]appelle|est|:)?\s*([A-ZÀ-ÖØ-Þ][\p{L}'’-]+)\s+([A-ZÀ-ÖØ-Þ][\p{L}'’-]+)/u);
    const budget = message.match(/\b\d{3}[\s.]?\d{3}\s*\$?|\b\d{3}\s*k\b/i)?.[0] || "";
    setContact((current) => ({ ...current, firstName: nameMatch?.[1] || current.firstName, lastName: nameMatch?.[2] || current.lastName, email: email || current.email, phone: phone || current.phone }));
    setCriteria((current) => ({ ...current, budget: budget || current.budget, importantNeeds: message }));
    setNotice("J’ai extrait les informations visibles. Confirme-les; je te demanderai seulement ce qui manque.");
    setMode("review");
  }

  async function analyzeFiles() {
    if (authStatus !== "authenticated") return setError("Ta session doit être vérifiée avant d’importer un document.");
    if (!files.length) return setError("Ajoute au moins un document.");
    setBusy("analyze");
    setError("");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      const response = await authenticatedFetch("/api/extract-mandate-documents", { method: "POST", body: form });
      const payload = await response.json() as MandateDocumentExtractionResponse & { error?: string };
      if (response.status === 401) {
        throw new Error("Ta session a expiré — reconnecte-toi avant d’importer un document.");
      }
      if (!response.ok) throw new Error(payload.error || "L’analyse du document a échoué.");
      const person = payload.fields.buyers[0] || payload.summary.contactsIdentified[0] || payload.fields.sellers[0];
      if (person) setContact({ firstName: person.firstName, lastName: person.lastName, email: person.email, phone: person.phone, mailingAddress: person.mailingAddress });
      setCriteria((current) => ({
        ...current,
        preapprovalStatus: source === "preapproval" ? "received" : current.preapprovalStatus,
        propertyType: payload.fields.propertyType || current.propertyType,
        bedrooms: payload.fields.bedrooms || current.bedrooms,
        importantNeeds: payload.fields.importantInfo || current.importantNeeds,
      }));
      setNotice(person ? "L’acheteur a été identifié dans les documents. La recherche de doublons sera faite avant toute création." : "Le document a été analysé. Complète uniquement l’identité qui n’y figurait pas.");
      setMode("review");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’analyse du document a échoué.");
    } finally {
      setBusy("");
    }
  }

  async function createCase() {
    if (!contact.firstName.trim() && !contact.lastName.trim()) return setError("Le nom de l’acheteur est requis.");
    setBusy("save");
    setError("");
    try {
      const response = await authenticatedFetch("/api/buyer-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, criteria, source }),
      });
      const payload = await response.json() as { id?: string; primaryHref?: string; error?: string; reconnectUrl?: string; reusedClient?: boolean };
      if (response.status === 401) throw new Error("Ta session a expiré — reconnecte-toi.");
      if (!response.ok || !payload.id) throw new Error(payload.error || "Le dossier acheteur n’a pas pu être créé.");

      if (files.length) {
        const form = new FormData();
        files.forEach((file) => form.append("files", file));
        const upload = await authenticatedFetch(`/api/buyer-cases/${payload.id}/documents`, { method: "POST", body: form });
        if (!upload.ok) window.sessionStorage.setItem(`iacourtier-buyer-notice-${payload.id}`, "Le dossier est créé, mais les documents devront être téléversés de nouveau.");
      }
      router.push(payload.primaryHref || `/tableau-de-bord/acheteurs/${payload.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le dossier acheteur n’a pas pu être créé.");
    } finally {
      setBusy("");
    }
  }

  if (mode === "choice") return <div className="space-y-6">
    <header><p className="text-sm font-semibold text-teal-700">Coach IA · Nouveau dossier acheteur</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Comment veux-tu commencer?</h1><p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">Choisis la donnée que tu as déjà. IACourtier identifie la personne, recherche les doublons, relie la fiche client et crée le parcours.</p></header>
    <SessionStatusNotice />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Choice icon={PenLine} title="Entrer ses informations" onClick={() => start("manual", "manual")} />
      <Choice icon={Contact} title="Pièce d’identité" onClick={() => start("identity", "identity")} disabled={authStatus !== "authenticated"} />
      <Choice icon={WalletCards} title="Préapprobation" onClick={() => start("preapproval", "preapproval")} disabled={authStatus !== "authenticated"} />
      <Choice icon={FileText} title="Autre document" onClick={() => start("document", "document")} disabled={authStatus !== "authenticated"} />
      <Choice icon={MessageSquareText} title="Texto ou message" onClick={() => start("message", "message")} />
    </div>
  </div>;

  if (mode === "message") return <div className="space-y-6"><Back onClick={() => setMode("choice")} /><Panel title="Colle le message reçu" text="Je vais extraire uniquement ce qui est présent."><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={9} placeholder="Marie veut acheter une maison à Repentigny…" className="mt-5 w-full rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950" /><Primary onClick={parseMessage} disabled={!message.trim()}>Extraire les informations</Primary></Panel></div>;

  if (["identity", "preapproval", "document"].includes(mode)) return <div className="space-y-6"><Back onClick={() => setMode("choice")} /><SessionStatusNotice /><Panel title="Dépose le document" text="La session est vérifiée avant l’import. PDF et images, 12 fichiers maximum."><input ref={fileInput} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp" className="hidden" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 12))} /><button type="button" onClick={() => fileInput.current?.click()} className="mt-5 flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950"><UploadCloud className="h-8 w-8 text-teal-700" /><span className="mt-3 font-semibold">Choisir les documents</span></button>{files.length ? <p className="mt-3 text-sm text-slate-500">{files.map((file) => file.name).join(" · ")}</p> : null}<Primary onClick={analyzeFiles} disabled={authStatus !== "authenticated" || !files.length || busy === "analyze"}>{busy === "analyze" ? "Analyse en cours…" : "Analyser et identifier l’acheteur"}</Primary></Panel>{error ? <ErrorBox text={error} /> : null}</div>;

  return <div className="space-y-6"><Back onClick={() => setMode(mode === "review" ? "choice" : "choice")} />
    <header><p className="text-sm font-semibold text-teal-700">Vérification guidée</p><h1 className="mt-2 text-3xl font-semibold">Confirme l’acheteur et ce qui manque</h1><p className="mt-3 text-slate-600 dark:text-slate-300">Une seule fiche client sera utilisée. Si le nom, le courriel ou le téléphone existe déjà, IACourtier la reliera automatiquement.</p></header>
    {notice ? <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">{notice}</div> : null}
    <Panel title="Client acheteur" text="Identité et coordonnées"><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Prénom" value={contact.firstName} onChange={(value) => setContact({ ...contact, firstName: value })} /><Field label="Nom" value={contact.lastName} onChange={(value) => setContact({ ...contact, lastName: value })} /><Field label="Courriel" value={contact.email} onChange={(value) => setContact({ ...contact, email: value })} /><Field label="Téléphone" value={contact.phone} onChange={(value) => setContact({ ...contact, phone: value })} /></div></Panel>
    <Panel title="Qualification et critères" text={`Informations encore manquantes : ${missing.length ? missing.join(", ") : "aucune"}.`}><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Budget" value={criteria.budget} onChange={(value) => setCriteria({ ...criteria, budget: value })} /><Select label="Préapprobation" value={criteria.preapprovalStatus} onChange={(value) => setCriteria({ ...criteria, preapprovalStatus: value })} options={[["missing","À obtenir"],["requested","Demandée"],["received","Reçue"],["approved","Validée"]]} /><Field label="Secteurs" value={criteria.sectors.join(", ")} onChange={(value) => setCriteria({ ...criteria, sectors: value.split(",").map((item) => item.trim()).filter(Boolean) })} /><Field label="Type de propriété" value={criteria.propertyType} onChange={(value) => setCriteria({ ...criteria, propertyType: value })} /><Field label="Chambres" value={criteria.bedrooms} onChange={(value) => setCriteria({ ...criteria, bedrooms: value })} /><Field label="Échéancier" value={criteria.timeline} onChange={(value) => setCriteria({ ...criteria, timeline: value })} /><Field label="Besoins importants" value={criteria.importantNeeds} onChange={(value) => setCriteria({ ...criteria, importantNeeds: value })} /><Select label="Propriété actuelle à vendre?" value={criteria.propertyToSell === null ? "" : criteria.propertyToSell ? "yes" : "no"} onChange={(value) => setCriteria({ ...criteria, propertyToSell: value === "" ? null : value === "yes" })} options={[["","À confirmer"],["yes","Oui"],["no","Non"]]} /></div></Panel>
    {error ? <ErrorBox text={error} /> : null}<Primary onClick={createCase} disabled={busy === "save"}>{busy === "save" ? "Création du parcours…" : "Créer et ouvrir le dossier acheteur"}</Primary>
  </div>;
}

function Choice({ icon: Icon, title, onClick, disabled = false }: { icon: typeof PenLine; title: string; onClick: () => void; disabled?: boolean }) { return <button type="button" disabled={disabled} onClick={onClick} className="min-h-40 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-1 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900"><Icon className="h-6 w-6 text-teal-700" /><p className="mt-7 font-semibold">{title}</p></button>; }
function Panel({ title, text, children }: { title: string; text: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p>{children}</section>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="mb-2 block text-sm font-semibold">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string,string]> }) { return <label><span className="mb-2 block text-sm font-semibold">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">{options.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>; }
function Back({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />Retour</button>; }
function Primary({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) { return <button type="button" onClick={onClick} disabled={disabled} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" />{children}</button>; }
function ErrorBox({ text }: { text: string }) { return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">{text}</div>; }
