export type BrokerPartnerCategory = "hypothèque" | "inspection" | "notaire" | "assurance" | "arpenteur" | "entrepreneur" | "photographe" | "vidéaste" | "home-staging" | "déménagement" | "autre";

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
  professionalTitle: string;
  teamName: string;
  teamMode: "solo" | "team";
  agencyName: string;
  agencyBrandId: string;
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
  agencyLogo: string;
  teamLogo: string;
  teamBanner: string;
  teamPhoto: string;
  addressMode: "tu" | "vous";
  communicationTones: string[];
  primaryClienteles: string[];
  communicationApproaches: string[];
  businessGoals: string[];
  onboardingCompleted: boolean;
  partners: BrokerPartner[];
};

export const BROKER_PROFILE_KEY = "iacourtier_broker_profile";

export const emptyBrokerProfile: BrokerProfile = {
  fullName: "", professionalTitle: "", teamName: "", teamMode: "solo", agencyName: "", agencyBrandId: "", phone: "", mobile: "", email: "", website: "",
  professionalAddress: "", facebook: "", instagram: "", linkedin: "", tiktok: "", youtube: "",
  languages: "", biography: "", slogan: "", signature: "", bookingUrl: "", primaryColor: "#0f766e",
  secondaryColor: "#0f172a", preferredFont: "", photo: "", logo: "", banner: "", agencyLogo: "", teamLogo: "", teamBanner: "", teamPhoto: "", addressMode: "vous", communicationTones: [], primaryClienteles: [], communicationApproaches: [], businessGoals: [], onboardingCompleted: false, partners: [],
};

export function normalizeBrokerProfile(value: unknown): BrokerProfile {
  if (!value || typeof value !== "object") return { ...emptyBrokerProfile };
  const source = value as Partial<BrokerProfile>;
  return {
    ...emptyBrokerProfile,
    ...source,
    partners: Array.isArray(source.partners) ? source.partners : [],
    communicationTones: Array.isArray(source.communicationTones) ? source.communicationTones : [],
    primaryClienteles: Array.isArray(source.primaryClienteles) ? source.primaryClienteles : [],
    communicationApproaches: Array.isArray(source.communicationApproaches) ? source.communicationApproaches : [],
    businessGoals: Array.isArray(source.businessGoals) ? source.businessGoals : [],
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

export function isBrokerOnboardingComplete(profile: Partial<BrokerProfile>) {
  return Boolean(profile.onboardingCompleted && profile.fullName?.trim() && profile.agencyName?.trim() && profile.email?.trim());
}

export function saveBrokerProfile(profile: BrokerProfile) {
  if (typeof window !== "undefined") window.localStorage.setItem(BROKER_PROFILE_KEY, JSON.stringify(profile));
}

export function buildProfessionalSignature(profile: Partial<BrokerProfile>) {
  if (profile.signature?.trim()) return profile.signature.trim();
  return [
    profile.fullName,
    profile.professionalTitle,
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
    profile.professionalTitle && `Titre professionnel : ${profile.professionalTitle}`,
    profile.teamName && `Équipe : ${profile.teamName}`,
    profile.agencyName && `Agence : ${profile.agencyName}`,
    (profile.mobile || profile.phone) && `Téléphone : ${profile.mobile || profile.phone}`,
    profile.email && `Courriel : ${profile.email}`,
    profile.website && `Site Web : ${profile.website}`,
    profile.professionalAddress && `Adresse professionnelle : ${profile.professionalAddress}`,
    profile.languages && `Langues : ${profile.languages}`,
    profile.biography && `Biographie : ${profile.biography}`,
    profile.slogan && `Slogan : ${profile.slogan}`,
    profile.addressMode && `Forme d’adresse préférée : ${profile.addressMode === "tu" ? "tutoiement" : "vouvoiement"}`,
    profile.communicationTones?.length && `Tons préférés : ${profile.communicationTones.join(", ")}`,
    profile.primaryClienteles?.length && `Clientèles principales : ${profile.primaryClienteles.join(", ")}`,
    profile.communicationApproaches?.length && `Approches : ${profile.communicationApproaches.join(", ")}`,
    profile.businessGoals?.length && `Objectifs : ${profile.businessGoals.join(", ")}`,
    `Signature professionnelle : ${buildProfessionalSignature(profile) || "(non configurée)"}`,
    partners && `Partenaires recommandés : ${partners}`,
    profile.primaryColor && `Couleur principale : ${profile.primaryColor}`,
    profile.secondaryColor && `Couleur secondaire : ${profile.secondaryColor}`,
    profile.agencyLogo && "Logo officiel de l’agence disponible : oui",
    profile.teamLogo && "Logo de l’équipe disponible : oui",
    profile.photo && "Photo professionnelle disponible : oui",
    (profile.teamBanner || profile.banner) && "Bannière disponible : oui",
  ].filter(Boolean).join("\n");
}

export function buildBuyerGuideExample(profile: BrokerProfile) {
  const mortgagePartner = profile.partners.find((partner) => partner.category === "hypothèque");
  const inspector = profile.partners.find((partner) => partner.category === "inspection");
  return [
    `GUIDE ACHETEUR — ${profile.fullName || "Votre courtier"}`,
    [profile.professionalTitle, profile.agencyName, profile.teamName].filter(Boolean).join(" · "),
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

export const CLIENT_BRAND_SAFETY_RULES = `RÈGLE DE MARQUE ABSOLUE POUR TOUT CONTENU DESTINÉ AU CLIENT :
- Le contenu provient exclusivement du courtier et de son agence.
- Ne jamais écrire IACourtier, Coach IA, Assistant IA, intelligence artificielle, généré par IA ou Propulsé par IACourtier.
- Ne jamais présenter le courtier comme travaillant pour IACourtier.
- Utiliser uniquement le nom, l'agence, les coordonnées et la signature du profil professionnel.
- Si une information du profil est absente, l'omettre sans l'inventer.`;

export function sanitizeClientFacingContent(content: string, profile: Partial<BrokerProfile> = {}) {
  const identity = profile.agencyName?.trim() || profile.fullName?.trim() || "";
  return content
    .replace(/^.*(?:Propuls[ée] par IACourtier|g[ée]n[ée]r[ée] par (?:une )?IA).*$(?:\r?\n)?/gim, "")
    .replace(/\b(?:de|par|avec|chez)\s+(?:IACourtier|le Coach IA|un Assistant IA)\b/gi, "")
    .replace(/\b(?:IACourtier|Coach IA|Assistant IA)\b/gi, identity)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}
