export type ProspectionPriority = "Faible" | "Moyenne" | "Élevée";

export type ProspectionCategory =
  | "Successions"
  | "Divorces"
  | "Propriétés expirées"
  | "Reprises de finance"
  | "Vendeurs potentiels"
  | "Propriétés à forte équité"
  | "Propriétaires de plus de X années"
  | "Terrains"
  | "Multiplex"
  | "Opportunités investisseurs";

export type ProspectionOpportunity = {
  id: string;
  address: string;
  city: string;
  propertyType: string;
  category: ProspectionCategory;
  reason: string;
  score: number;
  priority: ProspectionPriority;
  signals: string[];
  actions: {
    facebook: string;
    email: string;
    call: string;
    sms: string;
    followUp7: string;
    followUp30: string;
    objections: string[];
    responses: string[];
  };
};

export const prospectionCategories: ProspectionCategory[] = [
  "Successions",
  "Divorces",
  "Propriétés expirées",
  "Reprises de finance",
  "Vendeurs potentiels",
  "Propriétés à forte équité",
  "Propriétaires de plus de X années",
  "Terrains",
  "Multiplex",
  "Opportunités investisseurs",
];

export const prospectionOpportunities: ProspectionOpportunity[] = [
  {
    id: "verdun-longue-detention",
    address: "4821 rue Wellington",
    city: "Montréal",
    propertyType: "Duplex",
    category: "Vendeurs potentiels",
    reason: "Propriété détenue depuis plus de 18 ans dans un secteur où les ventes récentes indiquent une forte demande pour les plex bien situés.",
    score: 91,
    priority: "Élevée",
    signals: ["Longue détention", "Secteur recherché", "Comparable vendu rapidement", "Potentiel de repositionnement locatif"],
    actions: {
      facebook: "Bonjour, je travaille avec plusieurs acheteurs sérieux qui recherchent activement des plex bien situés dans Verdun. Si vous avez déjà envisagé connaître la valeur actuelle de votre propriété, je serais heureux de vous préparer une estimation claire, sans engagement.",
      email: "Bonjour,\n\nJe vous écris parce que le marché des plex dans votre secteur demeure très actif. Plusieurs propriétaires qui détiennent leur immeuble depuis longtemps découvrent aujourd'hui une valeur intéressante.\n\nJe peux vous préparer une courte analyse comparative de votre propriété, simplement pour vous donner un portrait actuel du marché.\n\nSeriez-vous disponible cette semaine pour un court échange?",
      call: "Bonjour, je vous appelle parce que je suis courtier dans votre secteur et je suis de près les ventes de plex à Verdun. Votre immeuble correspond au type de propriété que plusieurs acheteurs recherchent. Je ne sais pas si vous avez un projet de vente, mais je peux vous donner une lecture actuelle du marché en quelques minutes.",
      sms: "Bonjour, ici votre courtier immobilier local. Les plex de votre secteur suscitent beaucoup d'intérêt. Souhaitez-vous recevoir une estimation rapide de la valeur actuelle de votre propriété?",
      followUp7: "Bonjour, je me permets une courte relance. J'ai préparé quelques données récentes sur les plex vendus près de chez vous. Je peux vous les transmettre si vous souhaitez connaître le marché actuel.",
      followUp30: "Bonjour, le marché des plex dans Verdun continue d'être actif. Si vous voulez une mise à jour de valeur ou simplement suivre l'évolution du secteur, je peux vous préparer un court portrait.",
      objections: ["Nous ne voulons pas vendre maintenant.", "Nous ne voulons pas être sollicités.", "Nous savons déjà combien vaut la propriété."],
      responses: [
        "Je comprends très bien. L'objectif n'est pas de vous pousser à vendre, mais de vous donner une information utile pour vos décisions futures.",
        "Je respecte ça. Je peux simplement vous envoyer une page de données de marché, puis vous me direz si c'est pertinent pour vous.",
        "Parfait. Mon analyse peut servir de deuxième lecture, basée sur les ventes récentes et les différences réelles entre les propriétés.",
      ],
    },
  },
  {
    id: "laval-succession",
    address: "2145 boulevard des Laurentides",
    city: "Laval",
    propertyType: "Maison",
    category: "Successions",
    reason: "Signal simulé de transfert successoral et propriété unifamiliale dans un secteur où les maisons détachées se vendent rapidement lorsqu'elles sont bien préparées.",
    score: 88,
    priority: "Élevée",
    signals: ["Succession probable", "Maison détachée", "Demande familiale", "Préparation de mise en marché utile"],
    actions: {
      facebook: "Bonjour, je sais que certaines démarches immobilières peuvent arriver dans des moments sensibles. Si vous avez besoin d'une opinion de valeur claire pour une propriété familiale à Laval, je peux vous aider avec tact et sans pression.",
      email: "Bonjour,\n\nJe me permets de vous écrire avec beaucoup de respect. Lorsqu'une propriété familiale doit être évaluée, il est souvent utile d'avoir une analyse simple, documentée et neutre.\n\nJe peux vous préparer une opinion de valeur basée sur les ventes comparables du secteur, sans engagement.\n\nSouhaitez-vous que je vous propose un moment pour en discuter?",
      call: "Bonjour, ici [Votre nom], courtier immobilier. Je travaille dans votre secteur et je prépare des portraits de marché pour quelques propriétaires. Je voulais simplement vous demander : est-ce que ce genre d'information pourrait vous être utile, même sans projet immédiat?",
      sms: "Bonjour, je peux vous aider à obtenir une opinion de valeur claire pour une propriété à Laval, sans pression. Voulez-vous que je vous envoie les prochaines étapes?",
      followUp7: "Bonjour, je voulais simplement vérifier si une courte opinion de valeur pourrait vous être utile pour clarifier les démarches autour de la propriété.",
      followUp30: "Bonjour, je reste disponible si vous souhaitez obtenir une analyse de marché sobre et documentée pour la propriété.",
      objections: ["Le moment est délicat.", "Nous devons parler à la famille.", "Nous ne savons pas encore quoi faire."],
      responses: [
        "Je comprends. On peut avancer à votre rythme, avec une simple analyse écrite pour alimenter vos discussions familiales.",
        "C'est tout à fait normal. Je peux préparer une base factuelle que vous pourrez partager aux personnes concernées.",
        "Justement, une opinion de valeur peut aider à comparer les options sans prendre de décision immédiate.",
      ],
    },
  },
  {
    id: "longueuil-expiree",
    address: "739 rue Saint-Charles Ouest",
    city: "Longueuil",
    propertyType: "Condo",
    category: "Propriétés expirées",
    reason: "Inscription simulée expirée après une période prolongée sur le marché. Opportunité de repositionnement du prix, des visuels et du message.",
    score: 84,
    priority: "Élevée",
    signals: ["Annonce expirée", "Temps sur marché élevé", "Prix possiblement à ajuster", "Nouvelle stratégie requise"],
    actions: {
      facebook: "Bonjour, j'ai remarqué que certaines propriétés comparables dans votre secteur ont mieux performé après un repositionnement de stratégie. Si vous souhaitez un deuxième regard sur votre condo, je peux vous préparer une analyse courte et concrète.",
      email: "Bonjour,\n\nLorsqu'une propriété ne se vend pas dans le délai espéré, ce n'est pas toujours une question de valeur. Le positionnement, les comparables, la présentation et la stratégie de relance peuvent faire une grande différence.\n\nJe peux vous offrir un audit rapide de votre ancienne mise en marché et identifier les ajustements prioritaires.\n\nVoulez-vous que je vous l'envoie?",
      call: "Bonjour, je vous appelle parce que votre propriété semble avoir été sur le marché récemment. Mon rôle serait de vous donner un regard neuf : prix, comparables, présentation et stratégie. Parfois quelques ajustements changent complètement la réception du marché.",
      sms: "Bonjour, votre condo pourrait bénéficier d'un repositionnement de mise en marché. Je peux vous préparer 3 recommandations concrètes si vous voulez.",
      followUp7: "Bonjour, j'ai relevé quelques ventes récentes qui pourraient aider à repositionner votre condo. Je peux vous transmettre une courte analyse.",
      followUp30: "Bonjour, si votre projet de vente est toujours d'actualité, je peux vous proposer une relance complète adaptée au marché actuel.",
      objections: ["Nous avons eu une mauvaise expérience.", "Nous ne voulons pas baisser le prix.", "Nous allons attendre."],
      responses: [
        "Je comprends. Mon approche commence par diagnostiquer ce qui n'a pas fonctionné avant de proposer quoi que ce soit.",
        "Une baisse n'est pas toujours la première solution. Il faut d'abord vérifier le positionnement, la présentation et la concurrence directe.",
        "Attendre peut être valable, mais il est utile de savoir quelles conditions devraient changer pour améliorer vos chances.",
      ],
    },
  },
  {
    id: "terrebonne-equite",
    address: "1180 croissant des Fougères",
    city: "Terrebonne",
    propertyType: "Maison",
    category: "Propriétés à forte équité",
    reason: "Achat simulé de longue date avec appréciation importante du secteur. Le propriétaire pourrait avoir une forte équité mobilisable.",
    score: 79,
    priority: "Moyenne",
    signals: ["Équité probable élevée", "Quartier familial", "Marché de maisons actif", "Projet d'agrandissement ou revente possible"],
    actions: {
      facebook: "Bonjour, plusieurs propriétaires de votre secteur ont vu leur équité augmenter avec les dernières années. Si vous souhaitez connaître vos options, je peux vous préparer un portrait simple : vendre, refinancer ou conserver.",
      email: "Bonjour,\n\nVotre secteur a connu une belle progression de valeur. Pour plusieurs propriétaires, cela ouvre des options : achat d'une autre propriété, investissement, rénovation ou vente éventuelle.\n\nJe peux vous préparer un court portrait de valeur et d'équité potentielle.\n\nEst-ce que ce serait utile pour vous?",
      call: "Bonjour, je suis courtier et je suis de près l'évolution des valeurs dans votre quartier. Plusieurs propriétaires ont aujourd'hui plus d'équité qu'ils le pensent. Je peux vous donner une estimation de marché et quelques options possibles.",
      sms: "Bonjour, votre secteur a fortement progressé. Voulez-vous recevoir une estimation rapide de votre valeur actuelle et de vos options?",
      followUp7: "Bonjour, je vous relance au sujet d'un portrait de valeur pour votre maison. Cela peut être utile même sans projet de vente immédiat.",
      followUp30: "Bonjour, je peux vous envoyer une mise à jour des ventes récentes autour de votre propriété si vous souhaitez suivre votre équité.",
      objections: ["Nous ne voulons pas vendre.", "Nous avons déjà refinancé.", "Ce n'est pas prioritaire."],
      responses: [
        "Aucun problème. L'analyse peut simplement servir à planifier vos options, même si vous gardez la maison.",
        "C'est justement utile de comparer la valeur actuelle avec les décisions déjà prises.",
        "Je comprends. Je peux vous envoyer une version courte, que vous garderez pour référence.",
      ],
    },
  },
  {
    id: "quebec-multiplex",
    address: "905 3e Avenue",
    city: "Québec",
    propertyType: "Triplex",
    category: "Multiplex",
    reason: "Triplex dans un secteur locatif stable avec potentiel d'optimisation. Les investisseurs recherchent des immeubles avec revenus prévisibles.",
    score: 82,
    priority: "Élevée",
    signals: ["Immeuble à revenus", "Secteur locatif", "Demande investisseurs", "Optimisation possible"],
    actions: {
      facebook: "Bonjour, les plex bien situés à Québec intéressent encore plusieurs investisseurs qualifiés. Si vous voulez connaître la valeur actuelle de votre immeuble et son potentiel, je peux vous préparer une analyse confidentielle.",
      email: "Bonjour,\n\nJe travaille avec des acheteurs qui recherchent des immeubles à revenus dans votre secteur. Avant de parler de vente, il serait utile d'établir la valeur actuelle, les revenus potentiels et les points à optimiser.\n\nJe peux vous préparer une analyse courte et confidentielle.\n\nSouhaitez-vous en discuter?",
      call: "Bonjour, je vous appelle au sujet de votre triplex. Les investisseurs évaluent ce type d'immeuble selon les revenus, l'état, les dépenses et le potentiel d'optimisation. Je peux vous donner une lecture actuelle du marché.",
      sms: "Bonjour, des investisseurs recherchent des plex dans votre secteur. Souhaitez-vous connaître la valeur actuelle de votre immeuble?",
      followUp7: "Bonjour, j'ai quelques données récentes sur les ventes de plex à Québec. Je peux vous les transmettre si vous voulez.",
      followUp30: "Bonjour, si vous souhaitez réévaluer la valeur de votre triplex ce mois-ci, je peux vous préparer un portrait à jour.",
      objections: ["Les revenus sont bons, nous gardons.", "Nous ne voulons pas déranger les locataires.", "Le marché investisseur est plus difficile."],
      responses: [
        "C'est une bonne raison de conserver. Une analyse peut tout de même vous donner un point de référence pour vos décisions.",
        "On peut faire une première analyse sans visite et sans déranger les occupants.",
        "Justement, il faut positionner l'immeuble avec des données solides pour attirer les bons acheteurs.",
      ],
    },
  },
  {
    id: "sherbrooke-terrain",
    address: "Chemin Sainte-Catherine",
    city: "Sherbrooke",
    propertyType: "Terrain",
    category: "Terrains",
    reason: "Terrain simulé près d'un axe de développement local. Potentiel à vérifier selon zonage, services et usages permis.",
    score: 73,
    priority: "Moyenne",
    signals: ["Terrain vacant", "Zonage à valider", "Potentiel promoteur", "Demande locale"],
    actions: {
      facebook: "Bonjour, je fais un suivi sur certains terrains de Sherbrooke qui pourraient intéresser des acheteurs ou promoteurs selon le zonage. Si vous souhaitez évaluer vos options, je peux vous aider à clarifier la valeur potentielle.",
      email: "Bonjour,\n\nLes terrains bien situés peuvent attirer des profils d'acheteurs très différents : particuliers, promoteurs ou investisseurs. La valeur dépend fortement du zonage, des services et des usages permis.\n\nJe peux vous préparer une première analyse de positionnement.\n\nSouhaitez-vous que je vérifie les comparables récents?",
      call: "Bonjour, je vous appelle au sujet d'un terrain dans votre secteur. Le marché dépend beaucoup du zonage et du potentiel d'utilisation. Je peux vous aider à voir s'il existe une opportunité de mise en marché.",
      sms: "Bonjour, je peux vous aider à évaluer le potentiel de votre terrain à Sherbrooke. Souhaitez-vous une courte analyse?",
      followUp7: "Bonjour, je peux vérifier quelques comparables de terrains autour de votre secteur si vous voulez une première idée de valeur.",
      followUp30: "Bonjour, je reste disponible si vous souhaitez explorer les options possibles pour votre terrain.",
      objections: ["Nous ne connaissons pas le zonage.", "Nous ne sommes pas pressés.", "C'est un dossier compliqué."],
      responses: [
        "On peut commencer par une validation simple des informations publiques avant toute démarche.",
        "C'est parfait. Une analyse préliminaire peut vous aider à décider du bon moment.",
        "Justement, mon rôle est de structurer les étapes et d'identifier les informations à vérifier.",
      ],
    },
  },
  {
    id: "gatineau-finance",
    address: "66 rue de la Falaise",
    city: "Gatineau",
    propertyType: "Maison",
    category: "Reprises de finance",
    reason: "Signal fictif de difficulté financière et propriété dans un secteur où une vente encadrée pourrait réduire les risques pour le propriétaire.",
    score: 76,
    priority: "Moyenne",
    signals: ["Risque financier simulé", "Maison unifamiliale", "Intervention rapide utile", "Approche délicate requise"],
    actions: {
      facebook: "Bonjour, si vous vivez une situation immobilière qui demande des décisions rapides, je peux vous aider à comprendre vos options avec discrétion et sans jugement.",
      email: "Bonjour,\n\nCertaines situations immobilières demandent d'agir rapidement, mais avec calme et méthode. Mon rôle est d'expliquer les options possibles, les délais réalistes et les impacts d'une vente bien encadrée.\n\nJe peux vous offrir une conversation confidentielle.\n\nSeriez-vous ouvert à un court échange?",
      call: "Bonjour, je vous appelle avec discrétion. J'aide des propriétaires à clarifier leurs options quand une situation devient urgente. L'objectif est de protéger vos intérêts et d'éviter une décision précipitée.",
      sms: "Bonjour, je peux vous aider à évaluer vos options immobilières rapidement et confidentiellement. Voulez-vous en discuter?",
      followUp7: "Bonjour, je voulais simplement vous rappeler que je peux vous aider à comparer vos options sans pression.",
      followUp30: "Bonjour, je reste disponible si vous souhaitez une discussion confidentielle sur vos options immobilières.",
      objections: ["C'est personnel.", "Nous ne voulons pas en parler.", "Nous avons déjà quelqu'un."],
      responses: [
        "Je comprends et je respecte votre confidentialité. Je peux simplement vous donner une information générale sur les options.",
        "Aucun problème. Gardez mes coordonnées si vous souhaitez un avis neutre plus tard.",
        "C'est très bien. Je peux agir comme deuxième opinion si vous voulez valider votre plan.",
      ],
    },
  },
  {
    id: "brossard-investisseur",
    address: "3105 avenue Panama",
    city: "Brossard",
    propertyType: "Commercial",
    category: "Opportunités investisseurs",
    reason: "Emplacement simulé près d'un pôle de transport et d'activités commerciales. Potentiel d'intérêt pour acheteurs investisseurs.",
    score: 80,
    priority: "Élevée",
    signals: ["Localisation stratégique", "Profil investisseur", "Flux commercial", "Potentiel de repositionnement"],
    actions: {
      facebook: "Bonjour, certains actifs bien situés à Brossard attirent encore des investisseurs qui recherchent des emplacements solides. Si vous voulez connaître la valeur et le positionnement possible de votre propriété, je peux vous préparer une analyse.",
      email: "Bonjour,\n\nJe suis de près les opportunités immobilières dans votre secteur, particulièrement les actifs qui peuvent intéresser des investisseurs. La valeur dépend du positionnement, du potentiel locatif et des ventes comparables.\n\nJe peux vous préparer une courte analyse confidentielle.\n\nSouhaitez-vous qu'on en discute?",
      call: "Bonjour, je vous appelle au sujet de votre propriété à Brossard. Plusieurs investisseurs regardent les actifs bien situés, mais il faut bien présenter le potentiel. Je peux vous donner une lecture du marché.",
      sms: "Bonjour, votre secteur attire des investisseurs. Voulez-vous connaître le potentiel actuel de votre propriété?",
      followUp7: "Bonjour, j'ai quelques observations sur le marché investisseur à Brossard. Je peux vous les envoyer si c'est utile.",
      followUp30: "Bonjour, si vous souhaitez réévaluer le potentiel de votre propriété ce mois-ci, je peux vous aider à le structurer.",
      objections: ["Nous voulons attendre.", "Le commercial est incertain.", "Nous ne savons pas quelle valeur demander."],
      responses: [
        "Attendre peut être pertinent, mais une analyse vous indique quelles conditions surveiller.",
        "C'est vrai. Il faut donc miser sur les données concrètes : emplacement, revenus, usages et comparables.",
        "Je peux établir une fourchette de positionnement et les facteurs qui la justifient.",
      ],
    },
  },
];
