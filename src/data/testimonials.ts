// Add, remove, or edit testimonials here — the Testimonials section
// renders this list automatically, in order.

export type Testimonial = {
  name: string;
  role: string;
  quote: string;
};

export const testimonials: Testimonial[] = [
  {
    name: "Marie-Claude L.",
    role: "Courtière, Rive-Nord de Montréal",
    quote:
      "En un mois, j'ai repris le contrôle de ma prospection. Je sais enfin qui appeler en premier chaque matin.",
  },
  {
    name: "Frédéric D.",
    role: "Courtier, Capitale-Nationale",
    quote:
      "Mes fiches Centris se rédigent en quelques minutes maintenant. Le temps gagné, je le mets sur mes clients.",
  },
  {
    name: "Isabelle T.",
    role: "Courtière, Montérégie",
    quote:
      "La bibliothèque de prompts vaut à elle seule l'abonnement. Je n'ai plus jamais l'écran blanc devant moi.",
  },
  {
    name: "Samuel R.",
    role: "Courtier, Lanaudière",
    quote:
      "Mes réseaux sociaux étaient abandonnés depuis des mois. Maintenant, tout est planifié et ça publie sans moi.",
  },
  {
    name: "Geneviève P.",
    role: "Courtière, Estrie",
    quote:
      "Les formations sont concrètes. Pas de théorie inutile, juste ce qu'il faut pour appliquer dès le lendemain.",
  },
  {
    name: "Alexandre M.",
    role: "Courtier, Outaouais",
    quote:
      "L'agent IA qualifie mes leads pendant que je suis en visite. C'est le genre d'avance qu'on ne peut plus rattraper.",
  },
];
