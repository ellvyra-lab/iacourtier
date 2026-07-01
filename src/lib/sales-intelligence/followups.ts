import type { SalesScriptContext, SalesStyleLabel } from "./types";

export function createFollowUps(context: SalesScriptContext, style: SalesStyleLabel) {
  if (style === "Top Performer") {
    return {
      followUp7: `${context.greeting}, je reviens vers vous rapidement. Je peux vous donner une lecture claire de ce que votre propriété pourrait valoir dans le marché actuel. Est-ce qu'un appel de 10 minutes cette semaine serait possible?`,
      followUp30: `${context.greeting}, je refais une tournée de mises à jour dans ${context.sector}. Voulez-vous que j'inclus votre propriété et qu'on regarde ensemble les options possibles?`,
    };
  }

  if (style === "Direct") {
    return {
      followUp7: `${context.greeting}, je fais un suivi. Souhaitez-vous toujours une opinion de valeur pour votre propriété de ${context.sector}? Je peux vous proposer deux plages cette semaine.`,
      followUp30: `${context.greeting}, je reviens vers vous pour votre propriété de ${context.sector}. Voulez-vous une mise à jour de valeur ce mois-ci?`,
    };
  }

  if (style === "Relationnel") {
    return {
      followUp7: `${context.greeting}, je vous relance doucement. Si vous le souhaitez, je peux vous envoyer quelques informations utiles sur le marché de ${context.sector}. Préférez-vous un court appel ou un résumé par courriel?`,
      followUp30: `${context.greeting}, j'espère que vous allez bien. Je reste disponible si vous voulez éventuellement un portrait de marché pour votre propriété. Est-ce que je peux vous envoyer une mise à jour locale?`,
    };
  }

  if (style === "Luxe") {
    return {
      followUp7: `${context.greeting}, je me permets une courte relance concernant l'évaluation confidentielle de votre propriété. Souhaitez-vous que nous réservions un moment cette semaine?`,
      followUp30: `${context.greeting}, je demeure disponible si vous souhaitez une mise à jour confidentielle du positionnement de votre propriété dans le marché actuel de ${context.sector}.`,
    };
  }

  return {
    followUp7: `${context.greeting}, petite relance rapide. Je peux vous préparer un aperçu simple des ventes récentes autour de ${context.sector}. Est-ce que ce serait pertinent pour vous cette semaine?`,
    followUp30: `${context.greeting}, je me permets de reprendre contact. Le marché bouge pas mal selon les secteurs. Voulez-vous que je vous envoie une courte mise à jour pour votre propriété de ${context.sector}?`,
  };
}
