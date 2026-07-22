"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, Loader2, Plus, Trash2, Upload } from "lucide-react";

import {
  buildBuyerGuideExample,
  emptyBrokerProfile,
  loadBrokerProfile,
  normalizeBrokerProfile,
  saveBrokerProfile,
  type BrokerPartner,
  type BrokerProfile,
  type BrokerPartnerCategory,
} from "@/lib/broker-profile";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PROFILE_FIELDS: Array<{ key: keyof BrokerProfile; label: string; type?: string; wide?: boolean }> = [
  { key: "fullName", label: "Nom complet *" }, { key: "teamName", label: "Nom de l’équipe" },
  { key: "agencyName", label: "Nom de l’agence *" }, { key: "phone", label: "Téléphone", type: "tel" },
  { key: "mobile", label: "Cellulaire", type: "tel" }, { key: "email", label: "Courriel *", type: "email" },
  { key: "website", label: "Site Web", type: "url" }, { key: "professionalAddress", label: "Adresse professionnelle", wide: true },
  { key: "facebook", label: "Facebook", type: "url" }, { key: "instagram", label: "Instagram", type: "url" },
  { key: "linkedin", label: "LinkedIn", type: "url" }, { key: "tiktok", label: "TikTok", type: "url" },
  { key: "youtube", label: "YouTube", type: "url" }, { key: "bookingUrl", label: "Calendrier de réservation", type: "url" },
  { key: "languages", label: "Langues parlées", wide: true }, { key: "slogan", label: "Slogan", wide: true },
  { key: "biography", label: "Biographie", wide: true }, { key: "signature", label: "Signature professionnelle", wide: true },
];

const ASSETS: Array<{ key: "photo" | "logo" | "banner"; label: string }> = [
  { key: "photo", label: "Photo professionnelle" },
  { key: "logo", label: "Logo" },
  { key: "banner", label: "Bannière" },
];

export function AccountSettingsForm() {
  const [profile, setProfile] = useState<BrokerProfile>(emptyBrokerProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const remote = normalizeBrokerProfile(user?.user_metadata?.broker_profile);
      const local = loadBrokerProfile();
      const selected = remote.fullName || remote.agencyName ? remote : local;
      setProfile({
        ...selected,
        fullName: selected.fullName || String(user?.user_metadata?.full_name || ""),
        email: selected.email || user?.email || "",
      });
      setLoading(false);
    });
  }, []);

  const completion = useMemo(() => {
    const required = [profile.fullName, profile.agencyName, profile.email, profile.mobile || profile.phone, profile.signature, profile.logo, profile.photo];
    return Math.round((required.filter((value) => Boolean(value)).length / required.length) * 100);
  }, [profile]);

  function update(key: keyof BrokerProfile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function importAsset(key: "photo" | "logo" | "banner", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("Utilisez une image de moins de 2 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update(key, typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  function addPartner() {
    const partner: BrokerPartner = {
      id: `partner-${Date.now()}`, name: "", company: "", phone: "", email: "", website: "", category: "autre", notes: "",
    };
    setProfile((current) => ({ ...current, partners: [...current.partners, partner] }));
  }

  function updatePartner(id: string, changes: Partial<BrokerPartner>) {
    setProfile((current) => ({
      ...current,
      partners: current.partners.map((partner) => partner.id === id ? { ...partner, ...changes } : partner),
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile.fullName.trim() || !profile.agencyName.trim() || !profile.email.trim()) {
      setError("Le nom, l’agence et le courriel sont obligatoires.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    saveBrokerProfile(profile);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: profile.fullName, broker_profile: profile },
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <p className="text-sm font-semibold text-electric-500">Configuration guidée par le Coach IA</p>
        <h1 className="mt-2 text-3xl font-semibold">Ton profil professionnel</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">Cette fiche devient la source officielle de tes courriels, guides, publications, PDF, automatisations et signatures.</p>
        <div className="mt-5 flex items-center gap-4"><div className="h-2 flex-1 overflow-hidden rounded-full bg-background"><div className="h-full bg-electric-500" style={{ width: `${completion}%` }} /></div><strong>{completion} %</strong></div>
      </section>

      <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <h2 className="text-xl font-semibold">Identité et coordonnées</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {PROFILE_FIELDS.map((field) => {
            const value = profile[field.key];
            if (typeof value !== "string") return null;
            const isLong = field.key === "biography" || field.key === "signature";
            return <label key={field.key} className={field.wide ? "md:col-span-2" : ""}><span className="mb-2 block text-sm font-medium">{field.label}</span>{isLong ? <textarea rows={4} value={value} onChange={(event) => update(field.key, event.target.value)} className="w-full rounded-xl border border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-electric-500" /> : <input type={field.type || "text"} value={value} onChange={(event) => update(field.key, event.target.value)} className="min-h-11 w-full rounded-xl border border-subtle bg-surface px-4 text-sm outline-none focus:border-electric-500" />}</label>;
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <h2 className="text-xl font-semibold">Identité visuelle</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">{ASSETS.map((asset) => <label key={asset.key} className="rounded-xl border border-dashed border-subtle bg-background p-4 text-sm font-medium"><span>{asset.label}</span>{profile[asset.key] ? <img src={profile[asset.key]} alt="" className="mt-3 h-28 w-full rounded-lg object-contain" /> : <Upload className="mt-5 h-8 w-8 text-muted" />}<input type="file" accept="image/*" onChange={(event) => importAsset(asset.key, event)} className="mt-3 block w-full text-xs" /></label>)}</div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Couleur principale<input type="color" value={profile.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} className="mt-2 h-11 w-full rounded-lg" /></label><label className="text-sm font-medium">Couleur secondaire<input type="color" value={profile.secondaryColor} onChange={(event) => update("secondaryColor", event.target.value)} className="mt-2 h-11 w-full rounded-lg" /></label><label className="text-sm font-medium">Police préférée<input value={profile.preferredFont} onChange={(event) => update("preferredFont", event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-subtle bg-surface px-4" /></label></div>
      </section>

      <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Bibliothèque de partenaires</h2><p className="mt-1 text-sm text-muted">Le Coach recommandera le partenaire pertinent selon l’étape du dossier.</p></div><button type="button" onClick={addPartner} className="inline-flex items-center gap-2 rounded-full border border-subtle px-4 py-2 text-sm font-semibold"><Plus className="h-4 w-4" />Ajouter</button></div>
        <div className="mt-5 space-y-4">{profile.partners.map((partner) => <div key={partner.id} className="grid gap-3 rounded-xl border border-subtle bg-background p-4 md:grid-cols-3"><input placeholder="Nom" value={partner.name} onChange={(e) => updatePartner(partner.id, { name: e.target.value })} className="rounded-lg border border-subtle bg-surface px-3 py-2" /><input placeholder="Entreprise" value={partner.company} onChange={(e) => updatePartner(partner.id, { company: e.target.value })} className="rounded-lg border border-subtle bg-surface px-3 py-2" /><select value={partner.category} onChange={(e) => updatePartner(partner.id, { category: e.target.value as BrokerPartnerCategory })} className="rounded-lg border border-subtle bg-surface px-3 py-2"><option value="hypothèque">Courtier hypothécaire</option><option value="inspection">Inspecteur</option><option value="notaire">Notaire</option><option value="assurance">Assureur</option><option value="autre">Autre</option></select><input placeholder="Téléphone" value={partner.phone} onChange={(e) => updatePartner(partner.id, { phone: e.target.value })} className="rounded-lg border border-subtle bg-surface px-3 py-2" /><input placeholder="Courriel" value={partner.email} onChange={(e) => updatePartner(partner.id, { email: e.target.value })} className="rounded-lg border border-subtle bg-surface px-3 py-2" /><div className="flex gap-2"><input placeholder="Site Web" value={partner.website} onChange={(e) => updatePartner(partner.id, { website: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-subtle bg-surface px-3 py-2" /><button type="button" aria-label="Supprimer le partenaire" onClick={() => setProfile((current) => ({ ...current, partners: current.partners.filter((item) => item.id !== partner.id) }))} className="rounded-lg border border-subtle p-2"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
      </section>

      <section className="rounded-2xl border border-subtle bg-surface-soft p-6"><h2 className="text-xl font-semibold">Aperçu automatique — Guide acheteur</h2><pre className="mt-4 whitespace-pre-wrap rounded-xl bg-background p-4 text-sm leading-6">{buildBuyerGuideExample(profile)}</pre></section>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={saving || loading} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-cyan-500 px-6 py-3 font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}{saved ? "Profil enregistré" : "Enregistrer mon profil professionnel"}</button>
    </form>
  );
}
