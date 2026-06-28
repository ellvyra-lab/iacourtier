export type Formation = {
  slug: string;
  title: string;
  description: string;
  level: "Débutant" | "Intermédiaire" | "Avancé";
  duration: string;
  modules: number;
};

export const formations: Formation[] = [
  {
    slug: "ia-pour-debutants",
    title: "IA pour débutants",
    description:
      "Comprendre l'IA générative et l'utiliser dès aujourd'hui, sans jargon technique.",
    level: "Débutant",
    duration: "1h45",
    modules: 6,
  },
  {
    slug: "chatgpt-immobilier",
    title: "ChatGPT immobilier",
    description:
      "Maîtriser ChatGPT pour la rédaction, la négociation et le service à la clientèle.",
    level: "Débutant",
    duration: "2h10",
    modules: 8,
  },
  {
    slug: "creer-des-publications",
    title: "Créer des publications",
    description:
      "Produire un mois de contenu réseaux sociaux en moins d'une heure.",
    level: "Intermédiaire",
    duration: "1h30",
    modules: 7,
  },
  {
    slug: "automatiser-hubspot",
    title: "Automatiser HubSpot",
    description:
      "Connecter votre CRM à l'IA pour un suivi client qui ne tombe jamais à plat.",
    level: "Avancé",
    duration: "2h40",
    modules: 9,
  },
  {
    slug: "creer-des-videos",
    title: "Créer des vidéos",
    description:
      "Produire des vidéos de visite et de marque personnelle avec l'IA générative.",
    level: "Intermédiaire",
    duration: "2h00",
    modules: 8,
  },
  {
    slug: "descriptions-centris",
    title: "Créer des descriptions Centris",
    description:
      "Rédiger des fiches Centris percutantes en moins de deux minutes chacune.",
    level: "Débutant",
    duration: "1h10",
    modules: 5,
  },
  {
    slug: "prospection-ia",
    title: "Prospection IA",
    description:
      "Identifier vos meilleurs prospects et prioriser vos appels grâce à des signaux concrets.",
    level: "Avancé",
    duration: "3h00",
    modules: 10,
  },
  {
    slug: "agent-ia",
    title: "Agent IA",
    description:
      "Construire votre propre agent IA capable de qualifier des leads pour vous, 24/7.",
    level: "Avancé",
    duration: "3h30",
    modules: 11,
  },
];
