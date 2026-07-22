export type BrokerPartnerCategory = "hypothèque" | "inspection" | "notaire" | "assurance" | "autre";

export type BrokerPartner = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  category: BrokerPartnerCategory;
  notes: string;
};

export type BrokerProfile = {
  fullName: string;
  teamName: string;
  agencyName: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  professionalAddress: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  youtube: string;
  languages: string;
  biography: string;
  slogan: string;
  signature: string;
  bookingUrl: string;
  primaryColor: string;
  secondaryColor: string;
  preferredFont: string;
  photo: string;
  logo: string;
  banner: string;
  partners: BrokerPartner[];
};

export const BROKER_PROFILE_KEY = "iacourtier_broker_profile";

export const emptyBrokerProfile: BrokerProfile = {
  fullName: "", teamName: "", agencyName: "", phone: "", mobile: "", email: "", website: "",
  professionalAddress: "", facebook: "", instagram: "", linkedin: "", tiktok: "", youtube: "",
  languages: "", biography: "", slogan: "", signature: "", bookingUrl: "", primaryColor: "#0f766e",
  secondaryColor: "#0f172a", preferredFont: "", photo: "", logo: "", banner: "", partners: [],
};

export function normalizeBrokerProfile(value: unknown): BrokerProfile {
  if (!value || typeof value !== "object") return { ...emptyBrokerProfile };
  const source = value as Partial<BrokerProfile>;
  return {
    ...emptyBrokerProfile,
    ...source,
    partners: Array.isArray(source.partners) ? source.partners : [],
  };
}

export function loadBrokerProfile(): BrokerProfile {
  if (typeof window === "undefined") return { ...emptyBrokerProfile };
  try {
    return normalizeBrokerProfile(JSON.parse(window.localStorage.getItem(BROKER_PROFILE_KEY) || "{}"));
  } catch {
    return { ...emptyBrokerProfile };
  }
}

export function saveBrokerProfile(profile: BrokerProfile) {
  if (typeof window !== "undefined") window.localStorage.setItem(BROKER_PROFILE_KEY, JSON.stringify(profile));
}

export function buildProfessionalSignature(profile: Partial<BrokerProfile>) {
  if (profile.signature?.trim()) return profile.signature.trim();
  return [
    profile.fullName,
    [profile.teamName, profile.agencyName].filter(Boolean).join(" · "),
    profile.mobile || profile.phone,
    profile.email,
    profile.website,
  ].filter(Boolean).join("\n");
}

export function formatBrokerProfileForPrompt(profile: Partial<BrokerProfile>) {
  const partners = (profile.partners || []).map((partner) =>
    `${partner.category}: ${partner.name}${partner.company ? ` — ${partner.company}` : ""}`,
  ).join("; ");
  return [
    profile.fullName && `Nom du courtier : ${profile.fullName}`,
    profile.teamName && `Équipe : ${profile.teamName}`,
    profile.agencyName && `Agence : ${profile.agencyName}`,
    (profile.mobile || profile.phone) && `Téléphone : ${profile.mobile || profile.phone}`,
    profile.email && `Courriel : ${profile.email}`,
    profile.website && `Site Web : ${profile.website}`,
    profile.professionalAddress && `Adresse professionnelle : ${profile.professionalAddress}`,
    profile.languages && `Langues : ${profile.languages}`,
    profile.biography && `Biographie : ${profile.biography}`,
    profile.slogan && `Slogan : ${profile.slogan}`,
    `Signature professionnelle : ${buildProfessionalSignature(profile) || "(non configurée)"}`,
    partners && `Partenaires recommandés : ${partners}`,
    profile.primaryColor && `Couleur principale : ${profile.primaryColor}`,
    profile.secondaryColor && `Couleur secondaire : ${profile.secondaryColor}`,
  ].filter(Boolean).join("\n");
}

export function buildBuyerGuideExample(profile: BrokerProfile) {
  const mortgagePartner = profile.partners.find((partner) => partner.category === "hypothèque");
  const inspector = profile.partners.find((partner) => partner.category === "inspection");
  return [
    `GUIDE ACHETEUR — ${profile.fullName || "Votre courtier"}`,
    profile.slogan || "Un accompagnement clair, du projet jusqu’aux clés.",
    "",
    "Bienvenue",
    `Je vous accompagne pour clarifier votre budget, prioriser vos critères, analyser chaque propriété et négocier avec méthode.`,
    "",
    "Les prochaines étapes",
    "1. Confirmer le financement et les critères essentiels.",
    "2. Sélectionner et visiter les propriétés pertinentes.",
    "3. Vérifier les documents et préparer une offre réfléchie.",
    "4. Coordonner l’inspection, le financement et le notaire.",
    "",
    mortgagePartner ? `Financement recommandé : ${mortgagePartner.name} — ${mortgagePartner.company}` : "",
    inspector ? `Inspection recommandée : ${inspector.name} — ${inspector.company}` : "",
    "",
    buildProfessionalSignature(profile),
  ].filter((line) => line !== "").join("\n");
}
