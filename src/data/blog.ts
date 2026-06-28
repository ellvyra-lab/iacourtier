export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: "IA pratique" | "Prospection" | "Marketing" | "Outils";
  date: string;
  readTime: string;
  content: string[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "5-facons-utiliser-chatgpt-courtage",
    title: "5 façons d'utiliser ChatGPT dans votre pratique de courtage",
    excerpt:
      "De la rédaction de fiches Centris au service client, voici cinq usages concrets pour commencer dès aujourd'hui.",
    category: "IA pratique",
    date: "2026-06-02",
    readTime: "6 min",
    content: [
      "ChatGPT n'est pas réservé aux développeurs. Pour un courtier immobilier, c'est avant tout un outil de rédaction et de réflexion qui peut faire gagner plusieurs heures par semaine.",
      "Premièrement, la rédaction de fiches Centris : en fournissant les caractéristiques d'une propriété, vous obtenez une première version de description en quelques secondes, à ajuster selon votre style.",
      "Deuxièmement, la préparation de scripts d'appel pour la prospection téléphonique, adaptés au profil du propriétaire que vous contactez.",
      "Troisièmement, la rédaction de courriels de suivi client, pour garder une communication régulière sans y passer vos soirées.",
      "Quatrièmement, la création de contenu pour vos réseaux sociaux, en transformant une simple idée en plusieurs publications prêtes à publier.",
      "Cinquièmement, la préparation de présentations pour vos rencontres avec des vendeurs, en structurant vos arguments de façon claire et convaincante.",
    ],
  },
  {
    slug: "prospection-ia-priorites",
    title: "Comment l'IA peut prioriser vos appels de prospection",
    excerpt:
      "Arrêtez de prospecter au hasard. Voici comment des signaux concrets peuvent guider vos appels chaque semaine.",
    category: "Prospection",
    date: "2026-05-20",
    readTime: "7 min",
    content: [
      "La prospection téléphonique reste l'une des activités les plus rentables pour un courtier, mais elle est souvent abordée sans réelle stratégie.",
      "En croisant des données publiques comme la durée de possession d'une propriété, son évaluation municipale et certains signaux de mise en marché, il devient possible d'établir une liste de prospects classés par probabilité de vendre.",
      "Cette approche permet de concentrer son énergie sur les appels les plus susceptibles de mener à un mandat, plutôt que de contacter une liste générique.",
      "L'objectif n'est pas de remplacer le contact humain, mais de savoir à qui parler en premier chaque matin.",
    ],
  },
  {
    slug: "automatiser-reseaux-sociaux",
    title: "Automatiser ses réseaux sociaux sans perdre sa voix",
    excerpt:
      "Publier régulièrement sans sonner robotique : voici l'équilibre à trouver avec l'IA.",
    category: "Marketing",
    date: "2026-05-05",
    readTime: "5 min",
    content: [
      "Beaucoup de courtiers abandonnent leurs réseaux sociaux faute de temps, pas faute d'idées.",
      "L'IA permet de transformer une idée brute, notée en quelques mots, en plusieurs publications complètes et cohérentes avec votre image de marque.",
      "La clé est de fournir à l'outil des exemples de votre propre style d'écriture, pour que le contenu généré vous ressemble réellement.",
      "Un calendrier de contenu planifié à l'avance, même partiellement automatisé, reste largement supérieur à une absence totale de publication.",
    ],
  },
  {
    slug: "choisir-ses-premiers-outils-ia",
    title: "Comment choisir ses premiers outils IA en tant que courtier",
    excerpt:
      "Trop d'options, pas assez de temps. Voici une méthode simple pour faire les bons choix.",
    category: "Outils",
    date: "2026-04-18",
    readTime: "6 min",
    content: [
      "Le nombre d'outils IA disponibles aujourd'hui peut donner le vertige, même à un courtier curieux.",
      "La meilleure approche est de partir d'un problème précis, par exemple le temps passé sur les descriptions Centris, plutôt que de chercher un outil universel.",
      "Choisissez un seul nouvel outil à la fois, intégrez-le pendant deux semaines, puis évaluez le temps réellement économisé avant d'en ajouter un autre.",
      "Cette approche progressive évite la surcharge technologique et garantit une adoption durable.",
    ],
  },
];
