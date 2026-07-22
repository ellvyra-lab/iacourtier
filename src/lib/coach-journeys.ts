export type CoachJourneySlug =
  | "mandat-vendeur" | "dossier-acheteur" | "achat-vente" | "offre-achat"
  | "contre-offre" | "mise-en-marche" | "visite-libre" | "prospection-vendeur"
  | "prospection-acheteur" | "suivi-client" | "preparer-notaire" | "apres-transaction";

export type CoachJourney = {
  slug: CoachJourneySlug;
  title: string;
  icon: string;
  summary: string;
  documents: string[];
  missingFields: string[];
  createdItems: string[];
  recommendedAutomations: string[];
};

export const COACH_JOURNEYS: Record<CoachJourneySlug, CoachJourney> = {
  "mandat-vendeur": { slug: "mandat-vendeur", icon: "🏠", title: "Nouveau mandat vendeur", summary: "Créer la fiche vendeur, la propriété et le pipeline vendeur.", documents: ["Acte de vente", "Certificat de localisation", "Déclaration du vendeur", "Taxes", "Photos", "Plans", "Évaluation"], missingFields: ["Prix demandé", "Date de mise en marché", "Disponibilité"], createdItems: ["Fiche vendeur", "Fiche propriété", "Pipeline vendeur", "Tâches"], recommendedAutomations: ["Courriel de bienvenue", "Suivi des documents", "Anniversaire", "Après-transaction"] },
  "dossier-acheteur": { slug: "dossier-acheteur", icon: "🔑", title: "Nouveau dossier acheteur", summary: "Qualifier l’acheteur sans l’envoyer dans un parcours vendeur.", documents: ["Préapprobation hypothécaire", "Contrat de courtage", "Pièce d’identité", "Offre d’achat", "Documents bancaires", "Autres"], missingFields: ["Budget", "Mise de fonds", "Secteurs", "Type de propriété", "Nombre de chambres", "Date souhaitée"], createdItems: ["Fiche client", "Fiche acheteur", "Pipeline acheteur", "Tâches", "Rappels", "Guide Acheteur personnalisé"], recommendedAutomations: ["Courriel de bienvenue", "Demande de renouvellement hypothécaire", "Suivi après visite", "Relance automatique", "Anniversaire", "Anniversaire d’achat", "Demande d’avis Google"] },
  "achat-vente": { slug: "achat-vente", icon: "🏡", title: "Achat + vente", summary: "Relier les pipelines acheteur et vendeur d’un même client.", documents: ["Documents acheteur", "Documents vendeur", "Préapprobation", "Documents de la propriété"], missingFields: ["Échéancier de vente", "Budget d’achat", "Secteurs", "Propriété à vendre"], createdItems: ["Fiche client multirôle", "Pipeline acheteur", "Pipeline vendeur", "Relation entre les transactions"], recommendedAutomations: ["Coordination des échéanciers", "Suivis acheteur", "Suivis vendeur"] },
  "offre-achat": { slug: "offre-achat", icon: "✍️", title: "Préparer une offre d’achat", summary: "Structurer l’offre, les conditions et les échéances.", documents: ["Fiche de la propriété", "Déclarations du vendeur", "Préapprobation", "Comparables"], missingFields: ["Prix offert", "Conditions", "Date d’occupation"], createdItems: ["Dossier d’offre", "Échéancier des conditions", "Tâches de suivi"], recommendedAutomations: ["Rappel des conditions", "Suivi de réponse"] },
  "contre-offre": { slug: "contre-offre", icon: "📑", title: "Préparer une contre-offre", summary: "Analyser la réponse et préparer la prochaine décision.", documents: ["Offre initiale", "Contre-offre reçue", "Comparables"], missingFields: ["Position du client", "Limites de négociation", "Échéance"], createdItems: ["Scénario de négociation", "Tâche de réponse"], recommendedAutomations: ["Rappel d’échéance"] },
  "mise-en-marche": { slug: "mise-en-marche", icon: "🚀", title: "Mise en marché", summary: "Préparer les contenus et le lancement de la propriété.", documents: ["Photos", "Description", "Caractéristiques", "Déclaration du vendeur"], missingFields: ["Prix", "Date de lancement", "Disponibilités"], createdItems: ["Plan de lancement", "Contenus marketing", "Calendrier"], recommendedAutomations: ["Courriel aux acheteurs", "Publications sociales", "Suivi des demandes"] },
  "visite-libre": { slug: "visite-libre", icon: "🏡", title: "Visite libre", summary: "Organiser la promotion, l’accueil et les suivis.", documents: ["Fiche propriété", "Photos", "Informations de visite"], missingFields: ["Date", "Heures", "Instructions d’accès"], createdItems: ["Plan de visite libre", "Liste de suivi"], recommendedAutomations: ["Rappels", "Suivi après visite"] },
  "prospection-vendeur": { slug: "prospection-vendeur", icon: "📞", title: "Prospection vendeur", summary: "Prioriser et appeler les propriétaires susceptibles de vendre.", documents: [], missingFields: ["Secteur", "Volume d’appels"], createdItems: ["Mission de prospection vendeur"], recommendedAutomations: ["Relance après appel"] },
  "prospection-acheteur": { slug: "prospection-acheteur", icon: "📞", title: "Prospection acheteur", summary: "Qualifier les demandes et projets d’achat.", documents: [], missingFields: ["Source", "Budget approximatif", "Secteurs"], createdItems: ["Mission de prospection acheteur"], recommendedAutomations: ["Qualification", "Relance"] },
  "suivi-client": { slug: "suivi-client", icon: "🤝", title: "Suivi client", summary: "Commencer par la relation engagée la plus urgente.", documents: [], missingFields: [], createdItems: ["Liste de suivis priorisée"], recommendedAutomations: ["Relance relationnelle"] },
  "preparer-notaire": { slug: "preparer-notaire", icon: "📅", title: "Préparer le notaire", summary: "Rassembler les informations et échéances avant la signature.", documents: ["Promesse d’achat", "Pièces d’identité", "Coordonnées du notaire"], missingFields: ["Date de signature", "Notaire", "Instructions"], createdItems: ["Checklist notaire", "Rappels"], recommendedAutomations: ["Rappel de signature", "Transmission des coordonnées"] },
  "apres-transaction": { slug: "apres-transaction", icon: "🎉", title: "Après transaction", summary: "Organiser le suivi relationnel après la conclusion.", documents: ["Acte de vente", "Date de transaction"], missingFields: ["Date d’emménagement", "Consentement de suivi"], createdItems: ["Plan après-transaction"], recommendedAutomations: ["Anniversaire d’achat", "Demande d’avis", "Suivi relationnel"] },
};

export function getCoachJourney(slug: string) {
  return COACH_JOURNEYS[slug as CoachJourneySlug] || null;
}

export function inferCoachJourney(message: string): CoachJourney | null {
  const value = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const slug: CoachJourneySlug | null =
    /contre.?offre/.test(value) ? "contre-offre" :
    /offre.*achat|promesse.*achat/.test(value) ? "offre-achat" :
    /achat\s*\+\s*vente|acheter.*vend|vend.*acheter/.test(value) ? "achat-vente" :
    /nouveau.*acheteur|dossier.*acheteur/.test(value) ? "dossier-acheteur" :
    /mandat|dossier.*vendeur/.test(value) ? "mandat-vendeur" :
    /visite libre/.test(value) ? "visite-libre" :
    /mise en marche|lancement.*propriete/.test(value) ? "mise-en-marche" :
    /prospect.*acheteur/.test(value) ? "prospection-acheteur" :
    /prospect|appel.*vendeur/.test(value) ? "prospection-vendeur" :
    /notaire/.test(value) ? "preparer-notaire" :
    /apres.*transaction|apres.*vente|avis google/.test(value) ? "apres-transaction" :
    /suivi|relance/.test(value) ? "suivi-client" : null;
  return slug ? COACH_JOURNEYS[slug] : null;
}
