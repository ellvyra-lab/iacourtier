"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Upload } from "lucide-react";

import { agencyLogoUrl, searchAgencyBrands } from "@/lib/agency-brands";
import {
  buildProfessionalSignature,
  emptyBrokerProfile,
  loadBrokerProfile,
  normalizeBrokerProfile,
  saveBrokerProfile,
  type BrokerPartner,
  type BrokerPartnerCategory,
  type BrokerProfile,
} from "@/lib/broker-profile";
import { createSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";

const STEPS = ["Qui êtes-vous?", "Agence", "Identité visuelle", "Coordonnées", "Équipe", "Partenaires", "Personnalité", "Objectifs", "Résumé"];
const TONES = ["chaleureux", "professionnel", "dynamique", "haut de gamme"];
const CLIENTELES = ["premiers acheteurs", "vendeurs", "investisseurs", "immeubles locatifs", "luxe", "commercial"];
const APPROACHES = ["consultative", "éducative", "orientée résultats", "accompagnement"];
const GOALS = ["Plus de vendeurs", "Plus d’acheteurs", "Plus de références", "Plus d’investisseurs", "Automatiser mon entreprise", "Développer ma présence sur les réseaux sociaux"];
const PARTNER_CATEGORIES: Array<{ value: BrokerPartnerCategory; label: string }> = [
  { value: "hypothèque", label: "Courtier hypothécaire" }, { value: "inspection", label: "Inspecteur" },
  { value: "notaire", label: "Notaire" }, { value: "assurance", label: "Assureur" },
  { value: "arpenteur", label: "Arpenteur" }, { value: "photographe", label: "Photographe" },
  { value: "home-staging", label: "Home staging" }, { value: "autre", label: "Autre partenaire" },
];

type AssetKey = "photo" | "logo" | "agencyLogo" | "teamLogo" | "teamPhoto" | "teamBanner";

export function BrokerWelcomeOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<BrokerProfile>(emptyBrokerProfile);
  const [agencyQuery, setAgencyQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const remote = normalizeBrokerProfile(data.user?.user_metadata?.broker_profile);
      const local = loadBrokerProfile();
      const source = remote.fullName || remote.agencyName ? remote : local;
      setProfile({ ...source, fullName: source.fullName || String(data.user?.user_metadata?.full_name || ""), email: source.email || data.user?.email || "" });
      setAgencyQuery(source.agencyName);
    });
  }, []);

  const agencies = useMemo(() => searchAgencyBrands(agencyQuery).slice(0, 8), [agencyQuery]);
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  function update<K extends keyof BrokerProfile>(key: K, value: BrokerProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function toggleList(key: "communicationTones" | "primaryClienteles" | "communicationApproaches" | "businessGoals", value: string) {
    setProfile((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  }

  function importImage(key: AssetKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) return setError("Utilisez une image de moins de 2 Mo.");
    const reader = new FileReader();
    reader.onload = () => update(key, typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  function addPartner(category: BrokerPartnerCategory) {
    const partner: BrokerPartner = { id: `partner-${Date.now()}`, name: "", company: "", phone: "", email: "", website: "", category, notes: "" };
    update("partners", [...profile.partners, partner]);
  }

  function updatePartner(id: string, changes: Partial<BrokerPartner>) {
    update("partners", profile.partners.map((partner) => partner.id === id ? { ...partner, ...changes } : partner));
  }

  function next() {
    if (step === 0 && (!profile.fullName.trim() || !profile.professionalTitle.trim())) return setError("Indiquez votre nom et votre titre professionnel.");
    if (step === 1 && !profile.agencyName.trim()) return setError("Sélectionnez une agence ou utilisez le nom saisi.");
    if (step === 3 && !profile.email.trim()) return setError("Le courriel est requis.");
    setError("");
    saveBrokerProfile(profile);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  async function finish() {
    setSaving(true);
    setError("");
    const completed = { ...profile, signature: profile.signature || buildProfessionalSignature(profile), onboardingCompleted: true };

    if (!isSupabaseBrowserConfigured()) {
      setSaving(false);
      setError("L’authentification n’est pas configurée. Vérifiez les variables Supabase sur Vercel.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      setSaving(false);
      setError("Votre session est absente ou expirée. Vous allez être redirigé vers la connexion.");
      window.setTimeout(() => router.replace("/connexion?next=/bienvenue"), 1200);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user || userData.user.id !== sessionData.session.user.id) {
      setSaving(false);
      setError("Impossible de confirmer votre identité. Veuillez vous reconnecter.");
      window.setTimeout(() => router.replace("/connexion?next=/bienvenue"), 1200);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: completed.fullName, broker_profile: completed } });
    setSaving(false);
    if (updateError) {
      const sessionExpired = /auth session|jwt|refresh token|session missing/i.test(updateError.message);
      setError(sessionExpired
        ? "Votre session a expiré. Veuillez vous reconnecter pour enregistrer votre profil."
        : "Le profil n’a pas pu être enregistré. Réessayez dans un instant.");
      if (sessionExpired) window.setTimeout(() => router.replace("/connexion?next=/bienvenue"), 1200);
      return;
    }
    saveBrokerProfile(completed);
    router.push("/tableau-de-bord");
    router.refresh();
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
      <p className="text-sm font-semibold text-electric-500">Assistant de bienvenue</p>
      <h1 className="mt-2 text-3xl font-semibold">Bienvenue dans IACourtier!</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Je vais configurer votre espace de travail afin que tous vos documents, guides, courriels, publications et automatisations soient déjà personnalisés. Cela prendra environ cinq minutes.</p>
      <div className="mt-5 flex items-center gap-4"><div className="h-2 flex-1 overflow-hidden rounded-full bg-background"><div className="h-full bg-electric-500 transition-all" style={{ width: `${progress}%` }} /></div><span className="text-sm font-semibold">{step + 1}/{STEPS.length}</span></div>
      <p className="mt-3 text-sm font-semibold">{STEPS[step]}</p>
    </section>

    <section className="min-h-[420px] rounded-2xl border border-subtle bg-surface-soft p-6">
      {step === 0 ? <div><StepTitle number={1} title="Qui êtes-vous?" /><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Nom complet *" value={profile.fullName} onChange={(value) => update("fullName", value)} /><Field label="Titre professionnel *" value={profile.professionalTitle} onChange={(value) => update("professionalTitle", value)} /><Field label="Langues parlées" value={profile.languages} onChange={(value) => update("languages", value)} /><UploadField label="Photo professionnelle" value={profile.photo} onChange={(event) => importImage("photo", event)} /><label className="md:col-span-2"><span className="mb-2 block text-sm font-medium">Petite biographie</span><textarea rows={5} value={profile.biography} onChange={(event) => update("biography", event.target.value)} className="w-full rounded-xl border border-subtle bg-background p-4" /></label></div></div> : null}

      {step === 1 ? <div><StepTitle number={2} title="Pour quelle agence ou bannière travaillez-vous?" /><Field label="Rechercher une agence" value={agencyQuery} onChange={setAgencyQuery} /><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{agencies.map((agency) => <button key={agency.id} type="button" onClick={() => { update("agencyBrandId", agency.id); update("agencyName", agency.officialName); update("agencyLogo", agencyLogoUrl(agency)); update("primaryColor", agency.primaryColor); update("secondaryColor", agency.secondaryColor); setAgencyQuery(agency.officialName); }} className={`rounded-xl border p-4 text-left ${profile.agencyBrandId === agency.id ? "border-electric-500 bg-electric-500/5" : "border-subtle bg-background"}`}><img src={agencyLogoUrl(agency)} alt="" className="h-12 w-12 rounded-lg object-contain" /><strong className="mt-3 block text-sm">{agency.officialName}</strong></button>)}</div>{agencyQuery && !agencies.length ? <button type="button" onClick={() => { update("agencyBrandId", "custom"); update("agencyName", agencyQuery.trim()); }} className="mt-4 rounded-full border border-subtle px-4 py-2 font-semibold">Utiliser « {agencyQuery} »</button> : null}</div> : null}

      {step === 2 ? <div><StepTitle number={3} title="Est-ce bien votre identité visuelle?" /><div className="mt-5 rounded-xl border border-subtle bg-background p-5"><div className="flex flex-wrap items-center gap-5">{profile.agencyLogo ? <img src={profile.agencyLogo} alt="" className="h-20 w-24 object-contain" /> : null}<div><p className="text-lg font-semibold">{profile.agencyName}</p><div className="mt-2 flex gap-2"><span className="h-7 w-12 rounded" style={{ backgroundColor: profile.primaryColor }} /><span className="h-7 w-12 rounded" style={{ backgroundColor: profile.secondaryColor }} /></div></div></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><UploadField label="Téléverser mon propre logo" value={profile.logo} onChange={(event) => importImage("logo", event)} /><UploadField label="Ajouter le logo de mon équipe" value={profile.teamLogo} onChange={(event) => importImage("teamLogo", event)} /></div></div> : null}

      {step === 3 ? <div><StepTitle number={4} title="Coordonnées" /><div className="mt-5 grid gap-4 md:grid-cols-2">{([["Téléphone", "phone"], ["Cellulaire", "mobile"], ["Courriel *", "email"], ["Site Web", "website"], ["Adresse professionnelle", "professionalAddress"], ["Facebook", "facebook"], ["Instagram", "instagram"], ["LinkedIn", "linkedin"], ["TikTok", "tiktok"], ["YouTube", "youtube"]] as Array<[string, keyof BrokerProfile]>).map(([label, key]) => <Field key={key} label={label} value={String(profile[key] || "")} onChange={(value) => update(key, value as never)} />)}</div></div> : null}

      {step === 4 ? <div><StepTitle number={5} title="Travaillez-vous seul ou en équipe?" /><div className="mt-4 flex gap-3">{(["solo", "team"] as const).map((mode) => <button key={mode} type="button" onClick={() => update("teamMode", mode)} className={`rounded-full border px-5 py-2 font-semibold ${profile.teamMode === mode ? "border-electric-500 bg-electric-500 text-white" : "border-subtle"}`}>{mode === "solo" ? "Je travaille seul" : "Je travaille en équipe"}</button>)}</div>{profile.teamMode === "team" ? <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Nom de l’équipe" value={profile.teamName} onChange={(value) => update("teamName", value)} /><UploadField label="Logo de l’équipe" value={profile.teamLogo} onChange={(event) => importImage("teamLogo", event)} /><UploadField label="Photo de l’équipe" value={profile.teamPhoto} onChange={(event) => importImage("teamPhoto", event)} /><UploadField label="Bannière de l’équipe" value={profile.teamBanner} onChange={(event) => importImage("teamBanner", event)} /></div> : null}</div> : null}

      {step === 5 ? <div><StepTitle number={6} title="Partenaires recommandés" /><div className="mt-4 flex flex-wrap gap-2">{PARTNER_CATEGORIES.map((category) => <button key={category.value} type="button" onClick={() => addPartner(category.value)} className="inline-flex items-center gap-1 rounded-full border border-subtle px-3 py-2 text-sm"><Plus className="h-3.5 w-3.5" />{category.label}</button>)}</div><div className="mt-5 space-y-3">{profile.partners.map((partner) => <div key={partner.id} className="grid gap-3 rounded-xl border border-subtle bg-background p-4 md:grid-cols-3"><Field label={PARTNER_CATEGORIES.find((item) => item.value === partner.category)?.label || partner.category} value={partner.name} onChange={(value) => updatePartner(partner.id, { name: value })} /><Field label="Entreprise" value={partner.company} onChange={(value) => updatePartner(partner.id, { company: value })} /><Field label="Téléphone ou courriel" value={partner.email || partner.phone} onChange={(value) => updatePartner(partner.id, value.includes("@") ? { email: value } : { phone: value })} /></div>)}</div></div> : null}

      {step === 6 ? <div><StepTitle number={7} title="Personnalité de vos communications" /><ChoiceGroup title="Je préfère" values={["tu", "vous"]} selected={[profile.addressMode]} onToggle={(value) => update("addressMode", value as "tu" | "vous")} /><ChoiceGroup title="Mon ton est" values={TONES} selected={profile.communicationTones} onToggle={(value) => toggleList("communicationTones", value)} /><ChoiceGroup title="Ma clientèle principale" values={CLIENTELES} selected={profile.primaryClienteles} onToggle={(value) => toggleList("primaryClienteles", value)} /><ChoiceGroup title="Mon approche" values={APPROACHES} selected={profile.communicationApproaches} onToggle={(value) => toggleList("communicationApproaches", value)} /></div> : null}

      {step === 7 ? <div><StepTitle number={8} title="Quels sont vos principaux objectifs?" /><ChoiceGroup title="Sélectionnez tous les objectifs pertinents" values={GOALS} selected={profile.businessGoals} onToggle={(value) => toggleList("businessGoals", value)} /></div> : null}

      {step === 8 ? <div><StepTitle number={9} title="Votre espace est prêt" /><div className="mt-5 grid gap-3 sm:grid-cols-2">{["Profil créé", "Agence configurée", "Logo chargé", "Couleurs appliquées", "Signature créée", "Partenaires enregistrés", "Style configuré", "Automatisations prêtes"].map((item) => <p key={item} className="flex items-center gap-2 rounded-xl bg-background p-4 text-sm font-semibold"><Check className="h-4 w-4 text-electric-500" />{item}</p>)}</div><div className="mt-6 rounded-xl border border-electric-500/30 bg-electric-500/5 p-5"><p className="font-semibold">Parfait!</p><p className="mt-2 text-sm leading-6 text-muted">À partir de maintenant, tous les courriels, PDF, guides, publications, signatures et automatisations utiliseront automatiquement votre image de marque.</p></div></div> : null}
    </section>

    {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <div className="flex items-center justify-between gap-3"><button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-subtle px-5 font-semibold disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Précédent</button>{step < STEPS.length - 1 ? <button type="button" onClick={next} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-electric-500 px-5 font-semibold text-white">Continuer<ChevronRight className="h-4 w-4" /></button> : <button type="button" onClick={finish} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-electric-500 px-5 font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Terminer la configuration</button>}</div>
  </div>;
}

function StepTitle({ number, title }: { number: number; title: string }) {
  return <div><p className="text-sm font-semibold text-electric-500">Étape {number}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-2 block text-sm font-medium">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-subtle bg-background px-4" /></label>;
}

function UploadField({ label, value, onChange }: { label: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <label className="rounded-xl border border-dashed border-subtle bg-background p-4"><span className="text-sm font-medium">{label}</span>{value ? <img src={value} alt="" className="mt-3 h-24 w-full rounded-lg object-contain" /> : <Upload className="mt-4 h-7 w-7 text-muted" />}<input type="file" accept="image/*" onChange={onChange} className="mt-3 block w-full text-xs" /></label>;
}

function ChoiceGroup({ title, values, selected, onToggle }: { title: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="mt-6"><p className="text-sm font-semibold">{title}</p><div className="mt-3 flex flex-wrap gap-2">{values.map((value) => <button key={value} type="button" onClick={() => onToggle(value)} className={`rounded-full border px-4 py-2 text-sm ${selected.includes(value) ? "border-electric-500 bg-electric-500 text-white" : "border-subtle bg-background"}`}>{value}</button>)}</div></div>;
}
