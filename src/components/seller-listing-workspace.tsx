"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, FileText, ImagePlus, Loader2, Megaphone, Save, Sparkles, Star, UploadCloud, Users } from "lucide-react";

import { loadBrokerProfile } from "@/lib/broker-profile";
import { PHOTO_CATEGORIES, type ListingGeneratedContent, type ListingFactStatus } from "@/lib/seller-listings";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";

type Fact = { id: string; key: string; label: string; value: string; status: ListingFactStatus; sourceLabel: string; sourceDocumentId?: string | null; confidence?: number | null; note?: string };
type Media = { id: string; name: string; url: string; category: string; position: number; is_cover: boolean; is_virtual_staging: boolean };
type Task = { id: string; category: string; title: string; status: "pending" | "completed"; validation_required: boolean };
type Automation = { id: string; name: string; status: "validation_required" | "approved" | "disabled"; external_delivery_enabled: boolean };
type WorkspaceData = {
  listing: {
    id: string;
    client_case_id?: string | null;
    status: string;
    validation_required: boolean;
    prepared_at: string | null;
    generated_content: ListingGeneratedContent;
    property: { address?: string; city?: string; postal_code?: string; property_type?: string; lot_number?: string } | null;
  };
  parties: Array<{ id: string; role: string; contact: { id: string; first_name: string; last_name: string; email?: string; phone?: string; mailing_address?: string } | Array<{ id: string; first_name: string; last_name: string; email?: string; phone?: string; mailing_address?: string }> }>;
  documents: Array<{ id: string; name: string; document_type: string; analysis_status: string; created_at: string }>;
  facts: Fact[];
  media: Media[];
  tasks: Task[];
  automations: Automation[];
  activity: Array<{ id: string; title: string; details?: string; created_at: string }>;
  readiness: number;
  readyToPrepare: boolean;
  missingQuestions: Array<{ key: string; label: string; question: string; required: boolean }>;
  coachMessage: string;
};

export function SellerListingWorkspace({ id }: { id: string }) {
  const { authenticatedFetch } = useDashboardAuth();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/seller-listings/${id}`, { cache: "no-store" });
      const payload = await response.json() as WorkspaceData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Le dossier n’a pas pu être chargé.");
      setData(payload);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le dossier n’a pas pu être chargé.");
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const key = `iacourtier-listing-notice-${id}`;
    const savedNotice = window.sessionStorage.getItem(key);
    if (savedNotice) {
      setNotice(savedNotice);
      window.sessionStorage.removeItem(key);
    }
  }, [id]);

  async function patch(body: Record<string, unknown>, busyKey: string, success?: string) {
    setBusy(busyKey);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/seller-listings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "La mise à jour a échoué.");
      if (success) setNotice(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La mise à jour a échoué.");
    } finally {
      setBusy("");
    }
  }

  async function uploadFiles(files: FileList | null, kind: "documents" | "media") {
    if (!files?.length) return;
    setBusy(kind);
    setError("");
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await authenticatedFetch(`/api/seller-listings/${id}/${kind}`, { method: "POST", body: formData });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Le téléversement a échoué.");
      setNotice(kind === "documents" ? "Documents sauvegardés dans le dossier de la propriété." : "Photos sauvegardées sans modification matérielle.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le téléversement a échoué.");
    } finally {
      setBusy("");
    }
  }

  async function prepareListing() {
    setBusy("prepare");
    setError("");
    try {
      const response = await authenticatedFetch(`/api/seller-listings/${id}/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerProfile: loadBrokerProfile() }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "La préparation a échoué.");
      setNotice("Inscription et plan marketing générés puis sauvegardés. Aucun contenu n’a été publié ni envoyé.");
      await load();
      document.getElementById("inscription")?.scrollIntoView({ behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La préparation a échoué.");
    } finally {
      setBusy("");
    }
  }

  async function movePhoto(media: Media, direction: -1 | 1) {
    if (!data) return;
    const ordered = [...data.media].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === media.id);
    const neighbor = ordered[index + direction];
    if (!neighbor) return;
    setBusy(`media-${media.id}`);
    try {
      await Promise.all([
        authenticatedFetch(`/api/seller-listings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "media", mediaId: media.id, position: neighbor.position }) }),
        authenticatedFetch(`/api/seller-listings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "media", mediaId: neighbor.id, position: media.position }) }),
      ]);
      await load();
    } finally {
      setBusy("");
    }
  }

  const groupedFacts = useMemo(() => data ? {
    confirmed: data.facts.filter((fact) => fact.status === "confirmed" && fact.value),
    toConfirm: data.facts.filter((fact) => fact.status === "to_confirm"),
    missing: data.facts.filter((fact) => fact.status === "missing" || !fact.value),
  } : { confirmed: [], toConfirm: [], missing: [] }, [data]);
  const missingPhotoCategories = useMemo(() => {
    if (!data) return [];
    return PHOTO_CATEGORIES.filter((category) => ["facade", "kitchen", "living_room", "bedroom", "outdoor"].includes(category.value) && !data.media.some((media) => media.category === category.value)).map((category) => category.label);
  }, [data]);

  if (loading && !data) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-700" /></div>;
  if (!data) return <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><h1 className="text-xl font-semibold">Dossier indisponible</h1><p className="mt-2 text-sm">{error}</p><Link href="/tableau-de-bord/inscriptions/nouvelle" className="mt-4 inline-flex font-semibold underline">Créer une inscription vendeur</Link></section>;

  const property = Array.isArray(data.listing.property) ? data.listing.property[0] : data.listing.property;
  const content = data.listing.generated_content;
  const hasContent = Boolean(content.listing.publicDescription || content.marketing.facebook);
  const cover = data.media.find((media) => media.is_cover);
  const sellerNames = data.parties.map((party) => { const contact = Array.isArray(party.contact) ? party.contact[0] : party.contact; return contact ? `${contact.first_name} ${contact.last_name}`.trim() : ""; }).filter(Boolean).join(" et ");
  const nextAnchor = data.missingQuestions.some((item) => item.required) ? "dossier" : !hasContent ? "inscription" : "suivis";

  return <div className="space-y-7">
    <div className="flex flex-wrap gap-4 text-sm font-semibold"><Link href="/tableau-de-bord/clients" className="text-slate-600 dark:text-slate-300">← Clients & dossiers</Link>{data.listing.client_case_id ? <Link href={`/tableau-de-bord/dossiers/${data.listing.client_case_id}`} className="text-teal-700">Voir le dossier unifié →</Link> : null}</div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-start">
        <div><p className="text-sm font-semibold text-teal-700">Dossier maître · Validation requise</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{property?.address || "Adresse à confirmer"}</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Vendeur : {sellerNames || "à confirmer"} · Mandat vendeur</p><div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/20 dark:text-teal-100"><strong>Prochaine action :</strong> {data.coachMessage}</div><a href={`#${nextAnchor}`} className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white">Continuer le dossier</a></div>
        <div className="min-w-52 rounded-2xl bg-slate-950 p-5 text-white dark:bg-white dark:text-slate-950"><p className="text-xs font-semibold uppercase tracking-wide opacity-70">Préparation</p><p className="mt-1 text-4xl font-semibold">{data.readiness} %</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20 dark:bg-slate-900/20"><div className="h-full rounded-full bg-teal-400" style={{ width: `${data.readiness}%` }} /></div></div>
      </div>
      <nav className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">{[["dossier","Résumé"],["dossier","Client"],["dossier","Propriété"],["dossier","Documents"],["suivis","Étapes"],["marketing","Marketing"],["suivis","Communications"],["suivis","Transaction"]].map(([href,label]) => <a key={label} href={`#${href}`} className="rounded-full px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">{label}</a>)}</nav>
    </section>

    {error ? <Alert tone="red" text={error} /> : null}
    {notice ? <Alert tone="green" text={notice} onClose={() => setNotice("")} /> : null}

    <section id="dossier" className="scroll-mt-6 space-y-5">
      <SectionHeading eyebrow="Dossier" title="Vendeur(s), propriété et documents" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Vendeur(s)" icon={Users}>{data.parties.map((party) => { const contact = Array.isArray(party.contact) ? party.contact[0] : party.contact; return contact ? <div key={party.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><p className="font-semibold">{contact.first_name} {contact.last_name}</p><p className="mt-1 text-sm text-slate-500">{contact.email || "Courriel à compléter"} · {contact.phone || "Téléphone à compléter"}</p></div> : null; })}</Panel>
        <Panel title="Propriété" icon={FileText}><DefinitionGrid items={[["Adresse",property?.address],["Ville",property?.city],["Code postal",property?.postal_code],["Type",property?.property_type],["Lot",property?.lot_number]]} /></Panel>
      </div>
      <Panel title="Documents de la propriété" icon={UploadCloud} action={<Link href={data.listing.client_case_id ? `/tableau-de-bord/dossiers/${data.listing.client_case_id}?add=document#ajouter-source` : "/tableau-de-bord/importer"} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Ajouter et analyser</Link>}>
        {data.documents.length ? <div className="grid gap-2 md:grid-cols-2">{data.documents.map((document) => <div key={document.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p className="truncate text-sm font-semibold">{document.name}</p><p className="mt-1 text-xs text-slate-500">{document.document_type} · Sauvegardé</p></div>)}</div> : <Empty text="Aucun document sauvegardé." />}
      </Panel>
      <FactSection title="Informations confirmées" facts={groupedFacts.confirmed} busy={busy} onSave={(fact, value, status) => patch({ action: "fact", fact: { ...fact, value, status, sourceLabel: status === "confirmed" && value !== fact.value ? "Confirmation du courtier" : fact.sourceLabel } }, `fact-${fact.id}`, "Information sauvegardée.")} />
      <FactSection title="À confirmer" facts={groupedFacts.toConfirm} busy={busy} onSave={(fact, value, status) => patch({ action: "fact", fact: { ...fact, value, status, sourceLabel: "Correction du courtier" } }, `fact-${fact.id}`, "Information mise à jour.")} />
      <FactSection title="Informations manquantes" facts={groupedFacts.missing} busy={busy} onSave={(fact, value, status) => patch({ action: "fact", fact: { ...fact, value, status, sourceLabel: "Saisie du courtier" } }, `fact-${fact.id}`, "Information ajoutée.")} />
    </section>

    <section id="inscription" className="scroll-mt-6 space-y-5">
      <SectionHeading eyebrow="Inscription" title="Description, addenda et checklists" />
      <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5 dark:border-teal-900 dark:bg-teal-950/20"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">Préparer à partir des faits confirmés</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">L’addenda exclut automatiquement tout élément non confirmé. Le résultat est sauvegardé, jamais publié automatiquement.</p></div><button type="button" onClick={prepareListing} disabled={!data.readyToPrepare || busy === "prepare"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === "prepare" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Préparer mon inscription</button></div>{!data.readyToPrepare ? <p className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200">Confirme d’abord : {data.missingQuestions.filter((item) => item.required).map((item) => item.label).join(", ")}.</p> : null}</div>
      {hasContent ? <div className="grid gap-4"><ContentCard title="Description publique" text={content.listing.publicDescription} /><ContentCard title="Version courte" text={content.listing.shortDescription} /><ContentCard title="Addenda descriptif" text={content.listing.addendum} warning="Validation du courtier requise avant toute utilisation juridique ou contractuelle." /><TwoLists leftTitle="Faits saillants" left={content.listing.highlights} rightTitle="Caractéristiques principales" right={content.listing.characteristics} /><ContentCard title="Résumé vendeur" text={content.listing.sellerSummary} /><TwoLists leftTitle="Points à valider avant publication" left={content.listing.validationPoints} rightTitle="Checklist du dossier" right={content.listing.dossierChecklist} /><ListCard title="Checklist de mise en marché" items={content.listing.marketingChecklist} /></div> : <Empty text="Clique « Préparer mon inscription » lorsque les informations essentielles sont confirmées." />}
    </section>

    <section id="marketing" className="scroll-mt-6 space-y-5">
      <SectionHeading eyebrow="Marketing" title="Contenus basés sur cette propriété" />
      {hasContent ? <div className="grid gap-4 lg:grid-cols-2"><ContentCard title="Facebook" text={content.marketing.facebook} /><ContentCard title="Instagram" text={content.marketing.instagram} /><ArrayCard title="Story Facebook" items={content.marketing.facebookStory} /><ArrayCard title="Story Instagram" items={content.marketing.instagramStory} /><ContentCard title="Bientôt sur le marché" text={content.marketing.comingSoon} /><ContentCard title="Nouvelle inscription" text={content.marketing.newListing} /><ContentCard title="Visite libre" text={content.marketing.openHouse} /><ArrayCard title="Carrousel" items={content.marketing.carousel.map((item) => `${item.title}\n${item.text}`)} /><ContentCard title="Script Reel" text={content.marketing.reelScript} /><ContentCard title="Vidéo de présentation" text={content.marketing.presentationVideoScript} /><ContentCard title="Vidéo courte" text={content.marketing.shortVideoScript} /><ContentCard title="Courriel aux acheteurs potentiels" text={content.marketing.buyerEmail} /><ContentCard title="Courriel aux courtiers" text={content.marketing.brokerEmail} /><ContentCard title="SMS de nouvelle inscription" text={content.marketing.sms} /></div> : <Empty text="Le plan marketing apparaîtra avec l’inscription préparée." />}
      <Alert tone="amber" text="Tous ces contenus sont des brouillons internes. Aucun courriel, SMS ou média social n’est envoyé ou publié par ce dossier." />
    </section>

    <section id="photos" className="scroll-mt-6 space-y-5">
      <SectionHeading eyebrow="Photos et médias" title="Galerie, ordre et couverture" />
      <label className="flex min-h-32 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 font-semibold dark:border-slate-700 dark:bg-slate-900"><ImagePlus className="h-6 w-6 text-teal-700" />{busy === "media" ? "Téléversement en cours…" : "Téléverser les photos originales"}<input type="file" multiple accept="image/jpeg,image/png,image/heic,image/heif,image/webp" className="hidden" onChange={(event) => uploadFiles(event.target.files, "media")} /></label>
      {data.media.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[...data.media].sort((a,b) => a.position-b.position).map((media) => <article key={media.id} className={`overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 ${media.is_cover ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200 dark:border-slate-800"}`}><div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-950">{media.url ? <Image src={media.url} alt={media.name} fill unoptimized className="object-cover" /> : null}{media.is_cover ? <span className="absolute left-3 top-3 rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">Photo principale</span> : null}</div><div className="space-y-3 p-4"><p className="truncate text-sm font-semibold">{media.name}</p><select value={media.category} onChange={(event) => patch({ action: "media", mediaId: media.id, category: event.target.value }, `media-${media.id}`)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">{PHOTO_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><div className="flex flex-wrap gap-2"><button type="button" onClick={() => patch({ action: "media", mediaId: media.id, isCover: true }, `media-${media.id}`, "Photo principale mise à jour.")} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold dark:border-slate-700"><Star className="h-3.5 w-3.5" />Couverture</button><button type="button" onClick={() => movePhoto(media, -1)} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700" aria-label="Monter"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" onClick={() => movePhoto(media, 1)} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700" aria-label="Descendre"><ArrowDown className="h-3.5 w-3.5" /></button></div></div></article>)}</div> : <Empty text="Ajoute les photos de la propriété, puis classe-les et choisis la couverture." />}
      <div className="grid gap-4 md:grid-cols-2"><Panel title="Suggestions du Coach" icon={Sparkles}><ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300"><li>• {cover ? `Utilise « ${cover.name} » comme base de couverture.` : "Sélectionne une photo principale nette et lumineuse."}</li><li>• {missingPhotoCategories.length ? `Photos encore souhaitables : ${missingPhotoCategories.join(", ")}.` : "Les principales catégories de pièces sont couvertes."}</li><li>• Garde les fichiers originaux pour les recadrages de diffusion.</li></ul></Panel><Panel title="Formats à préparer" icon={Megaphone}><DefinitionGrid items={[["Publication","1:1 ou 4:5"],["Story","9:16"],["Carrousel","4:5 cohérent"],["Couverture","photo principale sélectionnée"]]} /></Panel></div>
      <Alert tone="amber" text="Les originaux sont conservés sans modification matérielle. Toute mise en scène virtuelle devra être marquée explicitement avant diffusion." />
    </section>

    <section id="suivis" className="scroll-mt-6 space-y-5">
      <SectionHeading eyebrow="Suivis" title="Tâches, automatisations et historique" />
      <div className="grid gap-4 lg:grid-cols-2"><Panel title="Tâches" icon={Check}>{data.tasks.map((task) => <label key={task.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input type="checkbox" checked={task.status === "completed"} onChange={(event) => patch({ action: "task", taskId: task.id, status: event.target.checked ? "completed" : "pending" }, `task-${task.id}`)} className="mt-1" /><span><span className="block text-sm font-semibold">{task.title}</span><span className="text-xs text-slate-500">{task.category} · validation humaine</span></span></label>)}</Panel><Panel title="Automatisations recommandées" icon={Sparkles}>{data.automations.map((automation) => <div key={automation.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div><p className="text-sm font-semibold">{automation.name}</p><p className="text-xs text-slate-500">{automation.status === "approved" ? "Plan validé · envoi externe désactivé" : automation.status === "disabled" ? "Désactivée" : "Validation requise"}</p></div><button type="button" onClick={() => patch({ action: "automation", automationId: automation.id, status: automation.status === "approved" ? "validation_required" : "approved" }, `automation-${automation.id}`)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold dark:border-slate-700">{automation.status === "approved" ? "Révoquer" : "Valider le plan"}</button></div>)}</Panel></div>
      <Panel title="Historique" icon={FileText}>{data.activity.length ? <div className="space-y-3">{data.activity.map((event) => <div key={event.id} className="border-l-2 border-teal-500 pl-4"><p className="text-sm font-semibold">{event.title}</p><p className="text-xs text-slate-500">{new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</p>{event.details ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.details}</p> : null}</div>)}</div> : <Empty text="Aucun événement consigné." />}</Panel>
    </section>

    <section id="coach" className="scroll-mt-6 rounded-2xl bg-slate-950 p-6 text-white dark:bg-white dark:text-slate-950"><p className="flex items-center gap-2 text-sm font-semibold text-teal-300 dark:text-teal-700"><Sparkles className="h-4 w-4" />Coach · Prochaine meilleure action</p><p className="mt-4 text-xl font-semibold leading-8">{data.coachMessage}</p></section>
  </div>;
}

function FactSection({ title, facts, busy, onSave }: { title: string; facts: Fact[]; busy: string; onSave: (fact: Fact, value: string, status: ListingFactStatus) => void }) {
  return <Panel title={title} icon={Save}>{facts.length ? <div className="grid gap-3">{facts.map((fact) => <FactEditor key={fact.id} fact={fact} loading={busy === `fact-${fact.id}`} onSave={onSave} />)}</div> : <Empty text="Aucune information dans cette catégorie." />}</Panel>;
}

function FactEditor({ fact, loading, onSave }: { fact: Fact; loading: boolean; onSave: (fact: Fact, value: string, status: ListingFactStatus) => void }) {
  const [value, setValue] = useState(fact.value);
  const [status, setStatus] = useState<ListingFactStatus>(fact.status);
  useEffect(() => { setValue(fact.value); setStatus(fact.status); }, [fact.value, fact.status]);
  return <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="grid gap-3 md:grid-cols-[1fr_160px_auto]"><label><span className="text-sm font-semibold">{fact.label}</span><input value={value} onChange={(event) => { setValue(event.target.value); if (event.target.value !== fact.value) setStatus("to_confirm"); }} className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></label><select value={status} onChange={(event) => setStatus(event.target.value as ListingFactStatus)} className="min-h-10 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="confirmed">Confirmée</option><option value="to_confirm">À confirmer</option><option value="missing">Manquante</option></select><button type="button" disabled={loading} onClick={() => onSave(fact, value, status)} className="inline-flex min-h-10 self-end items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauver"}</button></div><p className="mt-2 text-xs text-slate-500">Source : {fact.sourceLabel}{fact.note ? ` · ${fact.note}` : ""}</p></div>;
}

function Panel({ title, icon: Icon, action, children }: { title: string; icon: typeof FileText; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-teal-700" />{title}</h3>{action}</div><div className="space-y-3">{children}</div></section>; }
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <header><p className="text-sm font-semibold text-teal-700">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2></header>; }
function DefinitionGrid({ items }: { items: Array<[string, unknown]> }) { return <dl className="grid gap-3 sm:grid-cols-2">{items.map(([label,value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium">{String(value || "À confirmer")}</dd></div>)}</dl>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">{text}</p>; }
function Alert({ tone, text, onClose }: { tone: "red" | "green" | "amber"; text: string; onClose?: () => void }) { const classes = tone === "red" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200" : tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"; return <div className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${classes}`}><p>{text}</p>{onClose ? <button type="button" onClick={onClose} className="font-semibold">×</button> : null}</div>; }
function ContentCard({ title, text, warning }: { title: string; text: string; warning?: string }) { return <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold">{title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">{text || "À préparer"}</p>{warning ? <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">{warning}</p> : null}</article>; }
function ListCard({ title, items }: { title: string; items: string[] }) { return <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold">{title}</h3><ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">{items.map((item,index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul></article>; }
function ArrayCard({ title, items }: { title: string; items: string[] }) { return <ListCard title={title} items={items.length ? items : ["À préparer"]} />; }
function TwoLists({ leftTitle, left, rightTitle, right }: { leftTitle: string; left: string[]; rightTitle: string; right: string[] }) { return <div className="grid gap-4 lg:grid-cols-2"><ListCard title={leftTitle} items={left} /><ListCard title={rightTitle} items={right} /></div>; }

