import type { ObjectionPlaybook, SalesStyleLabel } from "./types";

const baseObjections: ObjectionPlaybook[] = [
  {
    id: "not_selling",
    objection: "Je ne veux pas vendre",
    shortResponse: "Je comprends. Je ne vous appelle pas pour vous pousser à vendre.",
    conversationalResponse:
      "Je comprends très bien. Mon but est simplement de vous donner une lecture claire du marché pour que vous sachiez où vous vous situez, même si vous ne bougez pas maintenant.",
    directResponse: "Parfait. Si vous ne vendez pas, est-ce qu'une valeur à jour vous serait quand même utile pour planifier?",
    followUpQuestion: "Si vous aviez une valeur claire en main, est-ce que ça vous aiderait à planifier les prochaines années?",
    conversionGoal: "Obtenir la permission de préparer une estimation informative.",
  },
  {
    id: "waiting",
    objection: "Je vais attendre",
    shortResponse: "C'est raisonnable. La vraie question est d'attendre quoi exactement.",
    conversationalResponse:
      "Ça peut être une bonne stratégie. Ce que je recommande, c'est de connaître votre valeur actuelle et les conditions à surveiller pour décider au bon moment.",
    directResponse: "Je comprends. Qu'est-ce qui devrait changer pour que vous disiez : là, c'est le bon moment?",
    followUpQuestion: "Qu'est-ce qui vous ferait dire que le moment est bon pour regarder vos options?",
    conversionGoal: "Transformer l'attente en rendez-vous de planification.",
  },
  {
    id: "already_has_broker",
    objection: "J'ai déjà un courtier",
    shortResponse: "Parfait, c'est important d'avoir quelqu'un de confiance.",
    conversationalResponse:
      "Je respecte tout à fait ça. Je peux quand même vous offrir un deuxième regard ponctuel sur le marché, sans engagement et sans interférer avec votre relation.",
    directResponse: "Très bien. Est-ce que vous avez déjà une évaluation récente et documentée de votre propriété?",
    followUpQuestion: "Est-ce que votre courtier vous a préparé une mise à jour de valeur récemment?",
    conversionGoal: "Se positionner comme deuxième opinion professionnelle.",
  },
  {
    id: "sell_by_owner",
    objection: "Je veux vendre moi-même",
    shortResponse: "Je comprends. Plusieurs propriétaires veulent d'abord explorer cette option.",
    conversationalResponse:
      "C'est possible. Mon rôle peut simplement être de vous aider à valider le prix, les risques et la stratégie pour éviter de laisser de l'argent sur la table.",
    directResponse: "Parfait. Voulez-vous au moins valider votre prix avant de tester le marché?",
    followUpQuestion: "Avez-vous déjà établi votre prix demandé à partir de ventes comparables récentes?",
    conversionGoal: "Créer une ouverture vers une consultation stratégique.",
  },
  {
    id: "just_value",
    objection: "Je veux juste connaître la valeur",
    shortResponse: "Parfait, c'est exactement un bon point de départ.",
    conversationalResponse:
      "Aucun problème. Pour vous donner une valeur utile, il faut regarder la propriété, les comparables et votre contexte. Sinon, ce serait trop approximatif.",
    directResponse: "Oui, et pour vous donner une vraie valeur, il me faut quelques détails. Avez-vous 10 minutes?",
    followUpQuestion: "Est-ce que vous préférez un court appel ou un rendez-vous rapide pour que je vous donne une opinion sérieuse?",
    conversionGoal: "Convertir la curiosité en rendez-vous d'évaluation.",
  },
  {
    id: "market_uncertain",
    objection: "Le marché est incertain",
    shortResponse: "Justement, c'est dans ces moments-là qu'une bonne lecture aide le plus.",
    conversationalResponse:
      "Vous avez raison, le marché demande plus de nuance. Une analyse actuelle permet de voir ce qui se vend vraiment, à quel prix et avec quel délai.",
    directResponse: "C'est vrai. Voulez-vous voir ce que les acheteurs paient réellement dans votre secteur maintenant?",
    followUpQuestion: "Voulez-vous que je vous montre ce qui se passe concrètement dans votre secteur?",
    conversionGoal: "Transformer l'incertitude en besoin d'analyse.",
  },
  {
    id: "send_email",
    objection: "Envoyez-moi ça par courriel",
    shortResponse: "Bien sûr. Pour vous envoyer quelque chose d'utile, j'ai juste besoin de préciser deux points.",
    conversationalResponse:
      "Avec plaisir. Je veux éviter de vous envoyer un courriel générique. Si je comprends votre contexte en deux minutes, je pourrai vous envoyer quelque chose de vraiment pertinent.",
    directResponse: "Oui. Avant, dites-moi : vous voulez surtout connaître la valeur, le délai ou les options?",
    followUpQuestion: "Est-ce que votre curiosité porte plutôt sur la valeur, le délai de vente ou les options possibles?",
    conversionGoal: "Éviter la fuite par courriel et obtenir une micro-conversation.",
  },
  {
    id: "do_not_disturb",
    objection: "Je ne veux pas être dérangé",
    shortResponse: "Je comprends et je respecte ça.",
    conversationalResponse:
      "Je vous remercie de me le dire. Je peux fermer le suivi de mon côté. Avant de vous laisser, souhaitez-vous quand même recevoir une seule mise à jour de valeur par courriel?",
    directResponse: "Je respecte ça. Voulez-vous que je ferme le suivi complètement?",
    followUpQuestion: "Préférez-vous que je ne vous recontacte pas du tout, ou seulement si vous me le demandez?",
    conversionGoal: "Respecter la limite et préserver une porte ouverte.",
  },
  {
    id: "not_rushed",
    objection: "On n'est pas pressés",
    shortResponse: "C'est souvent la meilleure position pour prendre une bonne décision.",
    conversationalResponse:
      "Justement, quand on n'est pas pressé, on peut regarder le marché calmement et choisir le bon moment au lieu de subir une urgence plus tard.",
    directResponse: "Parfait. Voulez-vous connaître le meilleur scénario si vous vendiez dans 3, 6 ou 12 mois?",
    followUpQuestion: "Si le marché vous donnait une très bonne fenêtre, est-ce que vous voudriez au moins la connaître?",
    conversionGoal: "Positionner l'évaluation comme planification, pas comme pression.",
  },
  {
    id: "duproprio_first",
    objection: "Je veux essayer DuProprio avant",
    shortResponse: "Je comprends. Plusieurs propriétaires veulent tester le marché par eux-mêmes.",
    conversationalResponse:
      "Ça peut se faire. Mon conseil serait simplement de valider votre prix, votre stratégie et vos risques avant de commencer, parce que les premières semaines comptent beaucoup.",
    directResponse: "Parfait. Voulez-vous que je vous donne les trois erreurs à éviter avant de lancer?",
    followUpQuestion: "Si vous n'obtenez pas le résultat voulu, après combien de temps voudriez-vous revoir la stratégie?",
    conversionGoal: "Créer une consultation pré-lancement ou un plan B clair.",
  },
];

export function getObjectionPlaybooks(_style?: SalesStyleLabel): ObjectionPlaybook[] {
  return baseObjections;
}

export function formatObjectionResponses(style?: SalesStyleLabel): string[] {
  return getObjectionPlaybooks(style).map(
    (item) => `${item.objection} — ${item.conversationalResponse} Question de relance : ${item.followUpQuestion}`,
  );
}
