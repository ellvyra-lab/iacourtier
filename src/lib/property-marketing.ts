import { EMPTY_GENERATED_CONTENT, SELLER_TASK_TEMPLATES, type ListingGeneratedContent } from "@/lib/seller-listings";

export type PropertyMarketingStyle = "professional" | "warm" | "dynamic" | "premium" | "direct";
export type PropertyMarketingFact = { field?: string; fact_key?: string; label: string; value: string; status?: string };

const ADMINISTRATIVE_FACTS = new Set([
  "acquisitionDate", "acquisitionPrice", "mortgage", "owners", "notary", "sellerDeclaration",
  "habitezVousImmeuble", "occupiedBySeller", "lotNumber", "conditions", "modifiedInfo",
]);
const STYLE_OPENERS: Record<PropertyMarketingStyle, string> = {
  professional: "Découvrez cette propriété soigneusement présentée",
  warm: "Imaginez votre quotidien dans cette propriété accueillante",
  dynamic: "Une nouvelle occasion immobilière à découvrir",
  premium: "Une propriété distinctive où chaque détail compte",
  direct: "Nouvelle propriété sur le marché",
};

export function buildPropertyMarketingKit(input: {
  property: { address: string; city: string; postalCode?: string; propertyType?: string };
  facts: PropertyMarketingFact[];
  validationPoints?: string[];
  style?: PropertyMarketingStyle;
}): ListingGeneratedContent {
  const style = input.style || "professional";
  const generated = structuredClone(EMPTY_GENERATED_CONTENT);
  const address = formatPropertyAddress(input.property);
  const type = input.property.propertyType || "Propriété";
  const publicFacts = input.facts
    .filter((fact) => (!fact.status || fact.status === "confirmed") && fact.value?.trim())
    .filter((fact) => !ADMINISTRATIVE_FACTS.has(fact.field || fact.fact_key || ""))
    .filter((fact) => !["address", "city", "postalCode", "name", "firstName", "lastName"].includes(fact.field || fact.fact_key || ""));
  const distinctFacts = [...new Map(publicFacts.map((fact) => [`${fact.label}:${fact.value}`, fact])).values()].slice(0, 8);
  const highlights = distinctFacts.slice(0, 5).map((fact) => `${fact.label} : ${fact.value}`);
  const lead = `${STYLE_OPENERS[style]} : ${type.toLowerCase()} située au ${address}.`;
  const detail = highlights.length ? ` ${highlights.join(". ")}.` : "";
  const description = `${lead}${detail}`.replace(/\s+/g, " ").trim();
  const short = `${type} au ${address}. ${highlights.slice(0, 2).join(" · ")}`.trim();
  const hashtags = `#immobilier #${normalizeTag(input.property.city)} #nouvelleinscription`;

  generated.listing.publicDescription = description;
  generated.listing.shortDescription = short;
  generated.listing.addendum = highlights.join("\n");
  generated.listing.highlights = highlights;
  generated.listing.characteristics = highlights;
  generated.listing.sellerSummary = `${distinctFacts.length} renseignement(s) publicitaire(s) confirmé(s) sont prêts à valider.`;
  generated.listing.validationPoints = [...new Set(input.validationPoints || [])];
  generated.listing.dossierChecklist = SELLER_TASK_TEMPLATES.filter((task) => task.category === "dossier" || task.category === "inscription").map((task) => task.title);
  generated.listing.marketingChecklist = SELLER_TASK_TEMPLATES.filter((task) => task.category === "marketing" || task.category === "photos").map((task) => task.title);
  generated.marketing.facebook = `${description}\n\nÉcrivez-moi pour les détails ou pour planifier une visite.\n${hashtags}`;
  generated.marketing.instagram = `${short}\n\n${highlights.slice(0, 3).join("\n")}\n\n${hashtags}`;
  generated.marketing.facebookStory = [`NOUVEAUTÉ · ${type}`, address, highlights[0] || "Détails à venir"];
  generated.marketing.instagramStory = [...generated.marketing.facebookStory];
  generated.marketing.carousel = [
    { title: "Nouvelle propriété", text: address },
    ...distinctFacts.slice(0, 5).map((fact) => ({ title: fact.label, text: fact.value })),
    { title: "Planifier une visite", text: "Communiquez avec votre courtier." },
  ];
  generated.marketing.comingSoon = `Bientôt sur le marché · ${type} à ${input.property.city}. Détails à venir.`;
  generated.marketing.newListing = `NOUVELLE INSCRIPTION · ${description}`;
  generated.marketing.openHouse = `VISITE LIBRE · ${address} · [DATE ET HEURE À CONFIRMER].`;
  generated.marketing.priceReduction = `NOUVEAU PRIX · ${type} au ${address}. Communiquez avec votre courtier pour les détails.`;
  generated.marketing.acceptedOffer = `PROMESSE D’ACHAT ACCEPTÉE · ${address}. Merci aux parties pour leur confiance.`;
  generated.marketing.sold = `VENDU · ${address}. Félicitations aux vendeurs et aux acheteurs.`;
  generated.marketing.backOnMarket = `DE RETOUR SUR LE MARCHÉ · ${type} au ${address}. Une nouvelle occasion à saisir.`;
  generated.marketing.featured = `PROPRIÉTÉ EN VEDETTE · ${description}`;
  generated.marketing.reelScript = `Aujourd’hui, je vous présente ${type.toLowerCase()} au ${address}. ${highlights.slice(0, 3).join(". ")}. Contactez-moi pour visiter.`;
  generated.marketing.presentationVideoScript = generated.marketing.reelScript;
  generated.marketing.shortVideoScript = `${type} · ${address} · ${highlights[0] || "À découvrir"}.`;
  generated.marketing.buyerEmail = `Objet : Nouvelle propriété à ${input.property.city}\n\nBonjour,\n\n${description}\n\nSouhaitez-vous la visiter?\n`;
  generated.marketing.brokerEmail = `Objet : Nouvelle inscription — ${address}\n\nBonjour,\n\n${description}\n\nMerci de me contacter pour toute collaboration.\n`;
  generated.marketing.sms = `${type} au ${address}. Souhaitez-vous recevoir les détails ou planifier une visite?`;
  return generated;
}
export function formatPropertyAddress(property: { address: string; city: string; postalCode?: string }) {
  const city = property.city.trim();
  const postal = (property.postalCode || "").trim().toUpperCase();
  let line = property.address.trim();
  if (city) line = line.replace(new RegExp(`[,\\s-]*${escapeRegExp(city)}[,\\s-]*$`, "i"), "").trim();
  if (postal) line = line.replace(new RegExp(`[,\\s-]*${escapeRegExp(postal)}[,\\s-]*$`, "i"), "").trim();
  return [line, city ? `${city} (Québec)` : "", postal].filter(Boolean).join(" ");
}
function normalizeTag(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, ""); }
function escapeRegExp(value: string) { return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&"); }
