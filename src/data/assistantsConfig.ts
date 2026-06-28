// ============================================================
// V1 — Exactement 10 Assistants IA. Pas 300. Une base propre et
// scalable : ajouter un assistant plus tard = ajouter un objet
// ici, rien d'autre à construire dans l'architecture.
// ============================================================

export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  options?: string[];
};

export type AssistantConfig = {
  slug: string;
  emoji: string;
  title: string;
  result: string;
  description: string;
  fields: FieldConfig[];
  systemPrompt: string;
};

export const assistantsConfig: AssistantConfig[] = [
  {
    slug: "description-centris",
    emoji: "🏡",
    title: "Description Centris",
    result: "Rédigez une description immobilière en quelques minutes.",
    description: "Donnez les détails de la propriété, recevez une fiche complète et prête à publier.",
    fields: [
      { name: "type", label: "Type de propriété", type: "text", placeholder: "Maison, condo, multiplex...", required: true },
      { name: "ville", label: "Ville", type: "text", placeholder: "Terrebonne", required: true },
      { name: "caracteristiques", label: "Caractéristiques principales", type: "textarea", placeholder: "3 chambres, sous-sol fini, terrain de 6500 pi²...", required: true },
      { name: "public", label: "Public cible", type: "text", placeholder: "Jeune famille, investisseur, premier acheteur..." },
    ],
    systemPrompt:
      "Tu es un rédacteur immobilier québécois expérimenté. Rédige une description Centris professionnelle de 120 à 180 mots, ton chaleureux mais crédible, sans superlatifs exagérés. Termine par une invitation à planifier une visite.",
  },
  {
    slug: "publication-facebook",
    emoji: "📱",
    title: "Publication Facebook",
    result: "Créez une publication accrocheuse en quelques minutes.",
    description: "Une publication prête pour Facebook ou Instagram, dans un ton naturel.",
    fields: [
      { name: "sujet", label: "Sujet de la publication", type: "text", placeholder: "Nouvelle inscription, conseil, événement...", required: true },
      { name: "details", label: "Détails à inclure", type: "textarea", placeholder: "Adresse, caractéristique à mettre en avant...", required: true },
      { name: "ton", label: "Ton souhaité", type: "select", options: ["Chaleureux", "Professionnel", "Dynamique", "Décontracté"] },
    ],
    systemPrompt:
      "Tu es un spécialiste du contenu pour courtiers immobiliers québécois. Rédige une publication Facebook/Instagram courte (80 à 130 mots), engageante, avec un appel à l'action clair à la fin. Évite le jargon marketing générique.",
  },
  {
    slug: "courriel-vendeur",
    emoji: "📧",
    title: "Courriel vendeur",
    result: "Répondez à vos clients sans perdre votre soirée.",
    description: "Un courriel de mise à jour ou de suivi, rédigé en quelques secondes.",
    fields: [
      { name: "objectif", label: "Objectif du courriel", type: "text", placeholder: "Mise à jour après une semaine, relance, annonce d'une offre...", required: true },
      { name: "contexte", label: "Contexte", type: "textarea", placeholder: "Ce qui s'est passé récemment avec ce dossier", required: true },
    ],
    systemPrompt:
      "Tu es un courtier immobilier québécois qui rédige un courriel professionnel et chaleureux à un client vendeur. Reste clair, honnête, rassurant. 100 à 180 mots. Signe simplement par une formule de politesse, sans inventer de nom.",
  },
  {
    slug: "script-video",
    emoji: "🎥",
    title: "Script vidéo",
    result: "Préparez une vidéo de visite en quelques minutes.",
    description: "Un script court et accrocheur pour TikTok, Reels ou YouTube.",
    fields: [
      { name: "propriete", label: "Propriété ou sujet", type: "text", placeholder: "Bungalow à Repentigny avec piscine", required: true },
      { name: "duree", label: "Durée visée", type: "select", options: ["30 secondes", "45 secondes", "60 secondes"] },
      { name: "points_forts", label: "Points forts à montrer", type: "textarea", placeholder: "Cuisine rénovée, grand terrain, sous-sol fini..." },
    ],
    systemPrompt:
      "Tu es un créateur de contenu spécialisé en immobilier. Rédige un script vidéo dynamique avec une accroche dès la première phrase, découpé en moments clés (ex: 0-5s, 5-15s...). Ton naturel et énergique, pas robotique.",
  },
  {
    slug: "reponse-objection",
    emoji: "📞",
    title: "Réponse aux objections",
    result: "Répondez rapidement aux objections de vos clients.",
    description: "Une réponse posée et professionnelle pour chaque objection courante.",
    fields: [
      { name: "objection", label: "Objection du client", type: "textarea", placeholder: "Le prix me semble trop élevé pour le quartier...", required: true },
      { name: "contexte", label: "Contexte additionnel", type: "text", placeholder: "Premier acheteur, vendeur pressé, investisseur..." },
    ],
    systemPrompt:
      "Tu es un courtier immobilier québécois expérimenté en négociation. Rédige une réponse courte (60 à 120 mots), empathique, factuelle, jamais défensive, qui désamorce l'objection sans pression.",
  },
  {
    slug: "plan-marketing",
    emoji: "📈",
    title: "Plan marketing propriété",
    result: "Préparez une stratégie de mise en marché en quelques minutes.",
    description: "Un plan clair sur 30 jours, adapté à la propriété et au contexte.",
    fields: [
      { name: "propriete", label: "Type de propriété et ville", type: "text", placeholder: "Condo à Laval", required: true },
      { name: "contexte", label: "Contexte de vente", type: "select", options: ["Vente standard", "Vendeur pressé", "Reprise de finance", "Succession"] },
      { name: "objectif", label: "Objectif principal", type: "text", placeholder: "Vendre rapidement, maximiser le prix..." },
    ],
    systemPrompt:
      "Tu es un stratège marketing immobilier. Présente un plan de mise en marché sur 30 jours, structuré en semaines, avec des actions concrètes (Centris, réseaux sociaux, visites libres, suivi). Reste réaliste et actionnable.",
  },
  {
    slug: "calendrier-contenu",
    emoji: "📅",
    title: "Calendrier de contenu",
    result: "Planifiez votre mois en une seule séance.",
    description: "7 idées de publications pour la semaine, prêtes à suivre.",
    fields: [
      { name: "frequence", label: "Fréquence de publication", type: "select", options: ["3 fois par semaine", "5 fois par semaine", "Tous les jours"] },
      { name: "themes", label: "Thèmes à privilégier", type: "textarea", placeholder: "Conseils premiers acheteurs, coulisses, nouvelles inscriptions..." },
    ],
    systemPrompt:
      "Tu es un planificateur de contenu pour courtier immobilier. Propose une liste numérotée d'idées de publications pour la semaine, variées (conseils, propriétés, coulisses, témoignages), avec une courte description par idée.",
  },
  {
    slug: "message-prospection",
    emoji: "🏘",
    title: "Message de prospection",
    result: "Concentrez vos appels sur les bons propriétaires.",
    description: "Un script d'appel ou un message adapté à votre prospect.",
    fields: [
      { name: "type_prospect", label: "Type de prospect", type: "text", placeholder: "Propriétaire depuis 10 ans, terrain vacant...", required: true },
      { name: "canal", label: "Canal", type: "select", options: ["Appel téléphonique", "Message texte", "Message LinkedIn"] },
    ],
    systemPrompt:
      "Tu es un courtier immobilier qui prépare un message de prospection respectueux et non insistant. Adapte le ton au canal demandé. Pour un appel, structure en script avec une accroche, une question ouverte et une proposition de suivi.",
  },
  {
    slug: "suivi-client",
    emoji: "📋",
    title: "Suivi client",
    result: "Ne perdez plus jamais un client par manque de suivi.",
    description: "Un message de relance adapté à la situation du client.",
    fields: [
      { name: "situation", label: "Situation du client", type: "textarea", placeholder: "A visité une propriété il y a 5 jours sans donner de nouvelles", required: true },
      { name: "ton", label: "Ton souhaité", type: "select", options: ["Amical", "Professionnel", "Direct mais chaleureux"] },
    ],
    systemPrompt:
      "Tu es un courtier immobilier qui rédige un message de suivi court (texto ou courriel court), chaleureux, sans pression de vente, qui relance naturellement la conversation.",
  },
  {
    slug: "resume-document",
    emoji: "📄",
    title: "Résumé de document",
    result: "Comprenez un document long en quelques secondes.",
    description: "Un résumé clair d'une promesse d'achat, d'un bail ou d'un contrat.",
    fields: [
      { name: "document", label: "Collez le texte du document", type: "textarea", placeholder: "Collez ici le texte à résumer...", required: true },
    ],
    systemPrompt:
      "Tu es un assistant qui résume des documents immobiliers en langage simple, pour un courtier pressé. Structure le résumé en points clés (parties, montants, dates, conditions importantes). Ne donne jamais d'avis légal — précise que toute clause importante doit être validée par un professionnel.",
  },
];

export function getAssistantConfig(slug: string) {
  return assistantsConfig.find((a) => a.slug === slug);
}
