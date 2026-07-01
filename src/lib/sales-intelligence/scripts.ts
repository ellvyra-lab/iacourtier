import { createFollowUps } from "./followups";
import { getObjectionPlaybooks } from "./objection-handling";
import { normalizeSalesStyle } from "./styles";
import type { SalesProspectContext, SalesScriptContext, SalesScriptSet, SalesStyleLabel } from "./types";

const forbiddenTerms = [/mon radar/i, /\bradar\b/i, /\bia\b/i, /\bscore\b/i, /\bsignal\b/i, /succession détectée/i, /données publiques/i, /donnees publiques/i];

export function createSalesScripts(prospect: SalesProspectContext, styleInput?: SalesStyleLabel | string): SalesScriptSet {
  const style = normalizeSalesStyle(styleInput);
  const context = createSalesScriptContext(prospect);
  const followUps = createFollowUps(context, style);
  const scripts = createStyleScripts(context, style);

  return {
    firstCall: sanitizeSalesCopy(scripts.firstCall),
    firstText: sanitizeSalesCopy(scripts.firstText),
    firstEmail: sanitizeSalesCopy(scripts.firstEmail),
    socialMessage: sanitizeSalesCopy(scripts.socialMessage),
    followUp7: sanitizeSalesCopy(followUps.followUp7),
    followUp30: sanitizeSalesCopy(followUps.followUp30),
    objections: getObjectionPlaybooks(style),
  };
}

export function createSalesScriptContext(prospect: SalesProspectContext): SalesScriptContext {
  const contactName = cleanName(prospect.contactName || prospect.ownerName);
  const brokerName = cleanName(prospect.brokerName) || "[Votre nom]";
  const brokerTitle = cleanName(prospect.brokerTitle) || "courtier immobilier";
  const city = cleanName(prospect.city) || "votre secteur";
  const address = cleanName(prospect.address) || "votre propriété";
  const propertyType = cleanName(prospect.propertyType);

  return {
    greeting: contactName ? `Bonjour ${contactName}` : "Bonjour",
    brokerName,
    brokerTitle,
    address,
    city,
    sector: city,
    propertyLabel: propertyType ? `${propertyType.toLowerCase()} de ${city}` : `propriété de ${city}`,
  };
}

function createStyleScripts(context: SalesScriptContext, style: SalesStyleLabel) {
  if (style === "Top Performer") {
    return {
      firstCall: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Je vais être direct : je suis très actif dans votre secteur en ce moment et je parle avec quelques propriétaires qui veulent savoir où ils se situent dans le marché. Est-ce que vendre votre propriété cette année fait partie de vos réflexions, ou pas du tout?`,
      firstText: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Je suis actif dans ${context.sector} cette semaine. Est-ce que vendre ou connaître votre valeur cette année fait partie de vos réflexions?`,
      firstEmail: `${context.greeting},\n\nJe suis ${context.brokerName}, ${context.brokerTitle}. Je travaille activement dans le secteur de ${context.sector} et plusieurs propriétaires veulent une lecture claire du marché avant de prendre une décision.\n\nJe peux vous préparer une opinion de valeur courte et concrète pour votre propriété située au ${context.address}. L'objectif n'est pas de vous pousser à vendre, mais de vous donner une vraie lecture de vos options.\n\nEst-ce qu'un appel de 10 minutes cette semaine serait possible?\n\nMerci,`,
      socialMessage: `${context.greeting}, je travaille activement dans ${context.sector} en ce moment. Petite question toute simple : est-ce que connaître la valeur actuelle de votre propriété vous serait utile cette année?`,
    };
  }

  if (style === "Direct") {
    return {
      firstCall: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Je vous appelle rapidement parce que je travaille dans votre secteur. Est-ce que vous avez pensé vendre votre propriété cette année, oui ou non?`,
      firstText: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Avez-vous pensé vendre votre propriété de ${context.sector} cette année, ou pas du tout?`,
      firstEmail: `${context.greeting},\n\nJe suis ${context.brokerName}, ${context.brokerTitle}, et je travaille actuellement dans ${context.sector}.\n\nJe voulais simplement vous demander si vendre votre propriété située au ${context.address} fait partie de vos réflexions cette année. Si oui, je peux vous préparer une estimation réaliste et vous expliquer vos options.\n\nÊtes-vous disponible pour un court appel cette semaine?\n\nMerci,`,
      socialMessage: `${context.greeting}, je suis ${context.brokerTitle} dans ${context.sector}. Est-ce que vendre votre propriété cette année est une possibilité, ou pas du tout?`,
    };
  }

  if (style === "Relationnel") {
    return {
      firstCall: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Je ne veux pas vous déranger longtemps. Je travaille dans votre secteur et j'offre à quelques propriétaires un portrait simple du marché. Est-ce que ce genre d'information pourrait vous être utile, même sans projet immédiat?`,
      firstText: `${context.greeting}, ici ${context.brokerName}. Je prépare des portraits de marché pour quelques propriétaires de ${context.sector}. Est-ce que ça vous serait utile d'avoir une idée de valeur, sans engagement?`,
      firstEmail: `${context.greeting},\n\nJ'espère que vous allez bien. Je suis ${context.brokerName}, ${context.brokerTitle}, et je travaille avec des propriétaires de ${context.sector} qui veulent mieux comprendre le marché actuel.\n\nMême sans projet de vente immédiat, ça peut être utile de connaître la valeur approximative de sa propriété, les ventes comparables et les options possibles pour les prochains mois.\n\nSi vous êtes ouvert, je pourrais préparer un court portrait pour votre propriété au ${context.address} et en discuter avec vous quelques minutes.\n\nEst-ce que ça vous conviendrait?\n\nBonne journée,`,
      socialMessage: `${context.greeting}, j'espère que vous allez bien. Je prépare quelques portraits de marché dans ${context.sector}. Est-ce que ça vous serait utile de savoir où se situe votre propriété aujourd'hui?`,
    };
  }

  if (style === "Luxe") {
    return {
      firstCall: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Je vous contacte avec discrétion, car je prépare des évaluations personnalisées dans votre secteur. Seriez-vous ouvert à une lecture confidentielle du positionnement de votre propriété dans le marché actuel?`,
      firstText: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Je peux vous préparer une évaluation confidentielle de votre propriété à ${context.sector}. Seriez-vous ouvert à un court rendez-vous cette semaine?`,
      firstEmail: `${context.greeting},\n\nJe me permets de vous contacter à titre de ${context.brokerTitle} actif dans le secteur de ${context.sector}.\n\nPour plusieurs propriétaires, une évaluation confidentielle permet de mieux comprendre le positionnement réel de leur propriété, les tendances du marché et les scénarios possibles, sans nécessairement entreprendre une démarche de vente.\n\nJe serais heureux de préparer une analyse personnalisée pour votre propriété située au ${context.address}, puis de vous la présenter dans un court rendez-vous privé.\n\nSeriez-vous disponible cette semaine pour en discuter?\n\nCordialement,`,
      socialMessage: `${context.greeting}, je conseille des propriétaires qui souhaitent comprendre avec précision le positionnement de leur propriété. Seriez-vous ouvert à une lecture confidentielle du marché de ${context.sector}?`,
    };
  }

  return {
    firstCall: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Je suis très actif dans votre secteur en ce moment et je voulais simplement vous poser une petite question : est-ce que vendre votre propriété cette année fait partie de vos réflexions, ou pas du tout?`,
    firstText: `${context.greeting}, ici ${context.brokerName}, ${context.brokerTitle}. Je travaille dans ${context.sector} cette semaine. Est-ce que connaître la valeur actuelle de votre propriété vous serait utile? Aucune pression.`,
    firstEmail: `${context.greeting},\n\nJe me permets de vous écrire parce que je travaille activement dans le secteur de ${context.sector} et plusieurs propriétaires se demandent en ce moment ce que leur propriété pourrait valoir dans le marché actuel.\n\nSans engagement, je peux vous préparer un court portrait de valeur pour votre propriété située au ${context.address}. Ça vous donnerait une lecture claire des ventes récentes, de la demande actuelle et des options possibles si jamais vous vouliez réfléchir à la suite.\n\nEst-ce que vous seriez ouvert à un court appel cette semaine pour voir si ça pourrait vous être utile?\n\nAu plaisir,`,
    socialMessage: `${context.greeting}, je suis ${context.brokerTitle} dans le secteur de ${context.sector}. Je prépare quelques portraits de marché pour des propriétaires du coin. Est-ce que ça vous intéresserait d'avoir l'heure juste sur votre propriété?`,
  };
}

function sanitizeSalesCopy(value: string) {
  return forbiddenTerms.reduce((copy, term) => copy.replace(term, "mon analyse de marché"), value);
}

function cleanName(value?: string) {
  return value?.replace(/\s+/g, " ").trim() || "";
}
