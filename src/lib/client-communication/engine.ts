import { sanitizeClientFacingContent } from "@/lib/broker-profile";

export type ClientType = "acheteur" | "vendeur" | "les_deux";
export type CommunicationChannel = "courriel" | "texto" | "téléphone" | "messenger";
export type LeadWarmth = "froid" | "tiède" | "chaud";
export type CommunicationTone = "chaleureux" | "professionnel" | "amical" | "direct" | "rassurant" | "stratégique";
export type CommunicationLength = "courte" | "standard" | "détaillée";

export type ClientCommunicationInput = {
  clientType: ClientType;
  journeyStage: string;
  channel: CommunicationChannel;
  objective: string;
  warmth: LeadWarmth;
  context: Record<string, string | number | boolean | null | undefined>;
  objection?: string;
  tone: CommunicationTone;
  length: CommunicationLength;
};

export type ClientCommunicationOutput = {
  mainMessage: string;
  shortVersion: string;
  followUpQuestion: string;
  recommendedNextAction: string;
  templateId: ClientCommunicationTemplateId;
};

export type ClientCommunicationTemplateId =
  | "birthday"
  | "new-seller-inquiry"
  | "new-buyer-inquiry"
  | "no-response-follow-up"
  | "evaluation-appointment"
  | "commission-objection"
  | "seller-wants-to-wait"
  | "buyer-not-prequalified"
  | "after-visit";

type Template = {
  id: ClientCommunicationTemplateId;
  matches: (input: ClientCommunicationInput) => number;
  create: (input: ClientCommunicationInput) => Omit<ClientCommunicationOutput, "templateId">;
};

const value = (input: ClientCommunicationInput, key: string, fallback: string) => {
  const candidate = input.context[key];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : fallback;
};

const greeting = (input: ClientCommunicationInput) => {
  const name = value(input, "clientName", "");
  if (input.channel === "courriel") return name ? `Bonjour ${name},` : "Bonjour,";
  return name ? `Bonjour ${name},` : "Bonjour,";
};

const close = (input: ClientCommunicationInput, invitation: string) => {
  if (input.channel === "téléphone") return invitation;
  if (input.tone === "direct") return `${invitation} Dites-moi ce qui vous convient.`;
  if (input.tone === "rassurant") return `${invitation} Il n'y a aucune obligation d'aller plus loin.`;
  if (input.tone === "stratégique") return `${invitation} On pourra ensuite choisir la suite avec les faits en main.`;
  return `${invitation} Je vais m'adapter à ce qui est le plus simple pour vous.`;
};

const TEMPLATES: Template[] = [
  {
    id: "birthday",
    matches: (input) => score(/anniversaire|bonne fête/i.test(input.journeyStage), input.objective.toLowerCase().includes("anniversaire")),
    create: (input) => {
      const name = value(input, "firstName", value(input, "clientName", ""));
      const availability = input.tone === "professionnel"
        ? "Je demeure disponible si je peux vous être utile au cours de la prochaine année."
        : input.tone === "amical"
          ? "Ça me fait toujours plaisir de garder contact, alors n’hésite pas si je peux t’aider."
          : "Au plaisir de garder contact — je reste disponible si je peux t’être utile.";
      const intro = input.tone === "professionnel"
        ? `Je tiens à vous souhaiter une excellente journée d’anniversaire, ${name}.`
        : input.tone === "amical"
          ? `Bonne fête ${name}! J’espère que tu profites pleinement de ta journée.`
          : `Je voulais simplement prendre un moment pour te souhaiter une très belle journée d’anniversaire, ${name}.`;
      const wish = input.tone === "professionnel"
        ? "J’espère que cette journée sera remplie de beaux moments avec les personnes qui vous sont chères."
        : "J’espère qu’elle sera remplie de beaux moments avec les personnes qui te sont chères.";
      return {
        mainMessage: `Bonjour ${name},

${intro} ${wish}

${availability}`,
        shortVersion: `Bonne fête ${name}! Je te souhaite une magnifique journée remplie de beaux moments.`,
        followUpQuestion: "Aucune question requise : ce message est purement relationnel.",
        recommendedNextAction: "Conserver le contact dans le suivi relationnel, sans relance commerciale.",
      };
    },
  },
  {
    id: "new-seller-inquiry",
    matches: (input) => score(input.clientType === "vendeur", /nouvelle|demande|information|vendre/i.test(input.journeyStage + input.objective)),
    create: (input) => {
      const property = value(input, "propertyAddress", "votre propriété");
      return {
        mainMessage: `${greeting(input)} merci de m'avoir écrit au sujet de ${property}. Je comprends que vous voulez d'abord voir clairement vos options avant de décider si une vente est la bonne prochaine étape. Qu'est-ce qui compte le plus pour vous en ce moment : le prix possible, l'échéancier ou la façon de préparer la propriété? Je peux vous donner un premier portrait concret et répondre à vos questions, sans pression. ${close(input, "Préférez-vous un court appel ou une rencontre")}`,
        shortVersion: `${greeting(input)} merci pour votre demande au sujet de ${property}. Quelle information vous aiderait le plus à évaluer vos options : la valeur, le moment ou la préparation? On peut en parler brièvement, sans engagement.`,
        followUpQuestion: "Qu'est-ce qui devrait être vrai pour que vous envisagiez sérieusement de vendre?",
        recommendedNextAction: "Répondre dans les quinze minutes et proposer deux plages précises pour un appel de découverte.",
      };
    },
  },
  {
    id: "new-buyer-inquiry",
    matches: (input) => score(input.clientType === "acheteur", /nouvelle|demande|information|acheter|propriété/i.test(input.journeyStage + input.objective)),
    create: (input) => {
      const property = value(input, "propertyAddress", "la propriété qui vous intéresse");
      return {
        mainMessage: `${greeting(input)} merci pour votre message concernant ${property}. Je comprends que vous voulez vérifier si elle correspond réellement à votre projet avant d'avancer. Parmi le secteur, le budget, les caractéristiques et la date d'emménagement, quel critère est non négociable pour vous? Je peux valider les informations importantes et vous proposer la prochaine étape la plus utile. ${close(input, "Souhaitez-vous qu'on commence par un court échange")}`,
        shortVersion: `${greeting(input)} merci pour votre intérêt envers ${property}. Quel est votre critère le plus important pour cette recherche? Je vais vérifier si cette propriété mérite qu'on organise une visite.`,
        followUpQuestion: "Quel compromis êtes-vous prêt à faire, et sur quel critère ne voulez-vous pas céder?",
        recommendedNextAction: "Qualifier les trois critères prioritaires avant de proposer une visite.",
      };
    },
  },
  {
    id: "no-response-follow-up",
    matches: (input) => score(/sans réponse|relance|aucune réponse|silence/i.test(input.journeyStage + input.objective), true),
    create: (input) => ({
      mainMessage: `${greeting(input)} je reviens simplement sur notre échange au sujet de ${value(input, "topic", "votre projet immobilier")}. Je comprends que vos priorités ont peut-être changé ou que le moment n'est pas idéal. Est-ce que le projet est toujours d'actualité, reporté ou réglé autrement? Une courte réponse me permettra de respecter votre rythme et de vous transmettre seulement ce qui est pertinent. ${close(input, "Vous pouvez me répondre en quelques mots")}`,
      shortVersion: `${greeting(input)} petit suivi au sujet de ${value(input, "topic", "votre projet")}. Est-ce toujours d'actualité, reporté ou réglé autrement? Une réponse courte suffit.`,
      followUpQuestion: "Est-ce que le projet est toujours actif, reporté ou réglé autrement?",
      recommendedNextAction: input.warmth === "froid" ? "Envoyer la version courte, puis prévoir une seule relance dans trente jours." : "Envoyer le message maintenant et planifier une relance finale dans sept jours.",
    }),
  },
  {
    id: "evaluation-appointment",
    matches: (input) => score(input.clientType === "vendeur", /rendez-vous|évaluation|evaluation|rencontre/i.test(input.journeyStage + input.objective)),
    create: (input) => ({
      mainMessage: `${greeting(input)} pour que notre rencontre soit vraiment utile, je vais préparer un portrait de ${value(input, "sector", "votre secteur")} et les comparables qui influencent la valeur de ${value(input, "propertyAddress", "votre propriété")}. Avant de finaliser l'analyse, y a-t-il des améliorations récentes ou une échéance que je devrais considérer? Je vous présenterai les options possibles et leurs conséquences, puis vous déciderez de la suite. ${close(input, "Est-ce que la plage proposée vous convient toujours")}`,
      shortVersion: `${greeting(input)} je prépare l'évaluation de ${value(input, "propertyAddress", "votre propriété")}. Y a-t-il des améliorations récentes ou une échéance importante à intégrer? Confirmez-moi aussi si notre plage vous convient.`,
      followUpQuestion: "Quelle décision voulez-vous être capable de prendre après notre rencontre?",
      recommendedNextAction: "Confirmer le rendez-vous et recueillir les améliorations, l'échéancier et les documents utiles.",
    }),
  },
  {
    id: "commission-objection",
    matches: (input) => score(/commission|taux|pourcentage|honoraires/i.test((input.objection || "") + input.objective), input.clientType === "vendeur"),
    create: (input) => ({
      mainMessage: `${greeting(input)} je comprends que la commission doit être justifiée par une valeur réelle, pas seulement par une promesse de service. Avant de comparer un pourcentage, quels résultats et quelles protections sont les plus importants pour vous pendant la vente? Je peux vous montrer précisément ce qui est inclus, comment chaque étape protège votre position et où se crée la valeur nette. ${close(input, "Regardons les chiffres ensemble avant de décider")}`,
      shortVersion: `${greeting(input)} votre question sur la commission est tout à fait légitime. Quels résultats voulez-vous absolument obtenir en échange? Je peux vous montrer clairement les services, les risques couverts et l'effet sur votre valeur nette.`,
      followUpQuestion: "Qu'auriez-vous besoin de voir pour considérer que les honoraires sont pleinement justifiés?",
      recommendedNextAction: "Présenter la valeur nette estimée, les risques couverts et les responsabilités précises avant de discuter du taux.",
    }),
  },
  {
    id: "seller-wants-to-wait",
    matches: (input) => score(input.clientType === "vendeur", /attendre|plus tard|pas maintenant|reporter/i.test((input.objection || "") + input.journeyStage + input.objective)),
    create: (input) => ({
      mainMessage: `${greeting(input)} je comprends que vous préférez attendre plutôt que prendre une décision trop vite. Qu'est-ce que vous espérez voir changer avant de reconsidérer la vente : le marché, votre situation personnelle ou la préparation de la propriété? Je peux suivre les indicateurs qui comptent pour vous et vous prévenir seulement lorsqu'une information mérite votre attention. ${close(input, "Fixons simplement un moment raisonnable pour refaire le point")}`,
      shortVersion: `${greeting(input)} je respecte votre décision d'attendre. Quel changement vous ferait réévaluer le projet? Je peux surveiller ce point précis et revenir vers vous au bon moment.`,
      followUpQuestion: "Quel événement ou quelle information vous ferait rouvrir la discussion?",
      recommendedNextAction: "Documenter le déclencheur attendu et convenir d'une date de suivi précise.",
    }),
  },
  {
    id: "buyer-not-prequalified",
    matches: (input) => score(input.clientType === "acheteur", /préqual|prequal|financement|hypoth/i.test(input.journeyStage + input.objective + (input.objection || ""))),
    create: (input) => ({
      mainMessage: `${greeting(input)} je comprends que vous voulez avancer dans votre recherche sans vous engager trop tôt dans les démarches financières. Une préqualification sert surtout à clarifier votre marge de manœuvre et à éviter de visiter des propriétés qui créeraient une pression inutile. Avez-vous déjà une idée du paiement mensuel avec lequel vous seriez réellement confortable? Je peux vous expliquer les étapes et vous référer une ressource, tout en vous laissant choisir le rythme. ${close(input, "Souhaitez-vous d'abord voir les options ou parler à un spécialiste")}`,
      shortVersion: `${greeting(input)} la préqualification sert d'abord à protéger votre recherche et votre budget. Quel paiement mensuel vous semblerait confortable? Je peux ensuite vous expliquer les options, sans pression.`,
      followUpQuestion: "Quel paiement mensuel préserverait votre qualité de vie après l'achat?",
      recommendedNextAction: "Clarifier le budget confortable, puis proposer une mise en relation hypothécaire avec permission.",
    }),
  },
  {
    id: "after-visit",
    matches: (input) => score(input.clientType === "acheteur", /après visite|apres visite|visite terminée|suivi visite/i.test(input.journeyStage + input.objective)),
    create: (input) => ({
      mainMessage: `${greeting(input)} merci d'avoir pris le temps de visiter ${value(input, "propertyAddress", "la propriété")}. Plutôt que de vous demander simplement si vous l'avez aimée, j'aimerais comprendre ce qui a changé dans votre réflexion après la visite. Quel élément vous rapproche d'une décision, et quel élément vous retient encore? Je peux vérifier les points factuels et vous aider à comparer cette option avec vos critères. ${close(input, "Envoyez-moi vos deux impressions principales quand vous serez prêt")}`,
      shortVersion: `${greeting(input)} après la visite, quel élément vous rapproche d'une décision et lequel vous retient encore? Je peux vérifier les points importants avant que vous choisissiez la suite.`,
      followUpQuestion: "Qu'est-ce qui vous empêcherait aujourd'hui de considérer cette propriété comme une option sérieuse?",
      recommendedNextAction: "Noter le principal attrait et le principal frein, puis répondre au frein avec une information vérifiable.",
    }),
  },
];

export function generateClientCommunication(input: ClientCommunicationInput): ClientCommunicationOutput {
  validateInput(input);
  const template = [...TEMPLATES].sort((a, b) => b.matches(input) - a.matches(input))[0];
  const output = template.create(input);
  const brokerIdentity = {
    fullName: value(input, "brokerName", ""),
    agencyName: value(input, "brokerAgency", ""),
  };
  return {
    ...output,
    mainMessage: sanitizeClientFacingContent(applyBrokerIdentity(adaptLength(output.mainMessage, input.length), input, false), brokerIdentity),
    shortVersion: sanitizeClientFacingContent(applyBrokerIdentity(adaptChannel(output.shortVersion, input.channel), input, true), brokerIdentity),
    templateId: template.id,
  };
}

function applyBrokerIdentity(message: string, input: ClientCommunicationInput, short: boolean) {
  const brokerName = value(input, "brokerName", "");
  const signature = value(input, "brokerSignature", brokerName);
  if (input.channel === "téléphone" || (!brokerName && !signature)) return message;
  if (input.channel === "texto" || short) return brokerName ? `${message} — ${brokerName}` : message;
  return signature ? `${message}\n\n${signature}` : message;
}

export function inferClientCommunicationRequest(message: string): ClientCommunicationInput | null {
  const normalized = message.toLowerCase();
  const communicationIntent = /(rédige|redige|écris|ecris|répond|repond|message|texto|courriel|messenger|script d'appel|relance|objection|suivi)/.test(normalized);
  if (!communicationIntent) return null;

  const clientType: ClientType = /acheteur/.test(normalized) ? "acheteur" : /vendeur|évaluation|evaluation|commission/.test(normalized) ? "vendeur" : "les_deux";
  const channel: CommunicationChannel = /texto|sms/.test(normalized)
    ? "texto"
    : /messenger|facebook/.test(normalized)
      ? "messenger"
      : /appel|téléphone|telephone/.test(normalized)
        ? "téléphone"
        : "courriel";
  const warmth: LeadWarmth = /froid/.test(normalized) ? "froid" : /chaud|urgent|prêt|pret/.test(normalized) ? "chaud" : "tiède";
  const tone: CommunicationTone = /rassur/.test(normalized) ? "rassurant" : /direct/.test(normalized) ? "direct" : /stratég/.test(normalized) ? "stratégique" : "chaleureux";
  const length: CommunicationLength = /très court|tres court|bref|texto/.test(normalized) ? "courte" : /détaill|detail/.test(normalized) ? "détaillée" : "standard";

  return {
    clientType,
    journeyStage: message,
    channel,
    objective: message,
    warmth,
    context: extractContext(message),
    objection: /objection|commission|attendre|préqual|prequal/.test(normalized) ? message : undefined,
    tone,
    length,
  };
}

export function formatClientCommunication(output: ClientCommunicationOutput) {
  return [
    `Message principal — ${output.mainMessage}`,
    `Version courte — ${output.shortVersion}`,
    `Question de suivi — ${output.followUpQuestion}`,
    `Prochaine action — ${output.recommendedNextAction}`,
  ].join("\n");
}

function score(...conditions: boolean[]) {
  return conditions.reduce((total, condition) => total + (condition ? 10 : 0), 0);
}

function adaptLength(message: string, length: CommunicationLength) {
  if (length === "détaillée") return message;
  const sentences = message.match(/[^.!?]+[.!?]+/g) || [message];
  return sentences.slice(0, length === "courte" ? 3 : 5).join(" ").trim();
}

function adaptChannel(message: string, channel: CommunicationChannel) {
  if (channel === "téléphone") return `Ouverture d'appel : ${message}`;
  return message;
}

function extractContext(message: string) {
  const address = message.match(/\d{1,5}\s+[A-Za-zÀ-ÿ0-9' -]+(?:rue|avenue|boulevard|chemin|rang)[A-Za-zÀ-ÿ0-9' -]*/i)?.[0];
  return { originalRequest: message, propertyAddress: address || undefined };
}

function validateInput(input: ClientCommunicationInput) {
  if (!input.clientType || !input.journeyStage || !input.channel || !input.objective || !input.warmth || !input.tone || !input.length) {
    throw new Error("Le moteur de communication requiert le type de client, l'étape, le canal, l'objectif, la chaleur, le ton et la longueur.");
  }
}
