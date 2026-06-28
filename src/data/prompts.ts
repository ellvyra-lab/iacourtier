export type Prompt = {
  id: string;
  title: string;
  category: "Prospection" | "Rédaction" | "Réseaux sociaux" | "Négociation" | "CRM";
  prompt: string;
};

export const prompts: Prompt[] = [
  {
    id: "p1",
    title: "Description Centris percutante",
    category: "Rédaction",
    prompt:
      "Rédige une fiche Centris pour une propriété [type] de [nombre de pièces] pièces à [ville], en mettant l'accent sur [caractéristique principale]. Ton chaleureux, phrases courtes, 150 mots maximum.",
  },
  {
    id: "p2",
    title: "Script d'appel prospect propriétaire",
    category: "Prospection",
    prompt:
      "Rédige un script d'appel pour contacter un propriétaire qui détient sa propriété depuis [nombre] années à [quartier]. Objectif: évaluer son intérêt à vendre sans paraître insistant.",
  },
  {
    id: "p3",
    title: "Semaine de contenu Instagram",
    category: "Réseaux sociaux",
    prompt:
      "Propose 7 idées de publications Instagram pour un courtier immobilier à [ville], pour la semaine prochaine, en variant entre conseils, coulisses et mises en valeur de propriétés.",
  },
  {
    id: "p4",
    title: "Réponse à une contre-offre",
    category: "Négociation",
    prompt:
      "Aide-moi à formuler une réponse professionnelle à une contre-offre de [montant] sur une propriété listée à [montant initial], en gardant la relation positive avec l'acheteur.",
  },
  {
    id: "p5",
    title: "Relance client CRM",
    category: "CRM",
    prompt:
      "Rédige un court message de relance pour un client qui a visité une propriété il y a [nombre] jours sans donner de nouvelles, ton amical et sans pression.",
  },
  {
    id: "p6",
    title: "Annonce nouvelle inscription",
    category: "Réseaux sociaux",
    prompt:
      "Rédige une publication Facebook annonçant une nouvelle inscription à [adresse], en insistant sur [caractéristique], avec un appel à l'action pour réserver une visite.",
  },
  {
    id: "p7",
    title: "Argumentaire visite libre",
    category: "Négociation",
    prompt:
      "Prépare un argumentaire de 5 points pour présenter les avantages d'une propriété à [adresse] lors d'une visite libre, adapté à des acheteurs [profil].",
  },
  {
    id: "p8",
    title: "Liste de prospects par secteur",
    category: "Prospection",
    prompt:
      "À partir de ces critères [durée de possession, type de propriété, secteur], propose une méthode pour prioriser une liste de prospects à contacter cette semaine.",
  },
  {
    id: "p9",
    title: "Courriel de bienvenue nouveau client",
    category: "CRM",
    prompt:
      "Rédige un courriel de bienvenue pour un nouveau client acheteur, présentant les prochaines étapes du processus d'achat de façon claire et rassurante.",
  },
];

export const categories = [
  "Tous",
  "Prospection",
  "Rédaction",
  "Réseaux sociaux",
  "Négociation",
  "CRM",
] as const;
