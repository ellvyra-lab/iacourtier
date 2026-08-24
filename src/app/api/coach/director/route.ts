import {
  formatClientCommunication,
  generateClientCommunication,
  inferClientCommunicationRequest,
} from "@/lib/client-communication/engine";
import { selectDirectorMessage } from "@/lib/director/message-library";
import { inferCoachJourney } from "@/lib/coach-journeys";
import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export type DirectorChatTurn = { role: "user" | "assistant"; content: string };

export type DirectorChatContext = {
  userName?: string;
  informationRequests: number;
  informationRequestExample?: { name: string; address: string } | null;
  sellerAppointmentsToPrepare: number;
  followupsDue: number;
  marketAnalysesToPrepare: number;
  radarProspectsToCall: number;
  callsToMake: number;
  mandatesWithMissingDocuments: number;
  marketingActionsToGenerate: number;
  totalProspects: number;
  prospectsCreatedToday: number;
  callsCompletedToday: number;
  callsAnsweredToday?: number;
  messagesLeftToday?: number;
  callResponseRateToday?: number;
  callFollowupsCreatedToday?: number;
  appointmentsObtainedFromCallsToday?: number;
  nextCallbackName?: string;
  nextCallbackDate?: string;
  overdueFollowups: number;
  appointmentsToday: number;
  appointmentsTomorrow: number;
  pendingMarketAnalyses: number;
  newContacts: number;
  buyerPipeline: number;
  sellerPipeline: number;
  buyerSellerContacts?: number;
  investorContacts?: number;
  multiRoleContacts?: number;
  automationsReadyToday?: number;
  automationsBlocked?: number;
  mortgageRenewalsWithin90Days?: number;
  automationHumanInterventions?: number;
  birthdayMessagesSentToday?: number;
  birthdayMessagesBlockedToday?: number;
  birthdayMissingEmailsToday?: number;
};

export type DirectorChatRequest = {
  message: string;
  history?: DirectorChatTurn[];
  context: DirectorChatContext;
};

export type DirectorAction = { label: string; href: string };

export type DirectorChatResponse = { reply: string; action: DirectorAction; secondaryActions: DirectorAction[] };

const ACTIONS = {
  respond: { label: "Répondre", href: "/tableau-de-bord/prospects/nouvelle-demande" },
  prepare: { label: "Préparer", href: "/tableau-de-bord/actions/prepare-market-analysis" },
  followUps: { label: "Faire les suivis", href: "/tableau-de-bord/prospects" },
  prospect: { label: "Prospecter", href: "/tableau-de-bord/radar-prospection" },
} as const satisfies Record<string, DirectorAction>;

// Ordre de priorité officiel de l'agence : une seule action principale, toujours calculée
// à partir des données réelles (jamais devinée dans le texte généré par OpenAI).
function buildPrimaryAction(context: DirectorChatContext): DirectorAction {
  if (context.informationRequests > 0) return ACTIONS.respond;
  if (context.sellerAppointmentsToPrepare > 0 || context.marketAnalysesToPrepare > 0) return ACTIONS.prepare;
  if (context.followupsDue > 0) return ACTIONS.followUps;
  return ACTIONS.prospect;
}

function buildSecondaryActions(primary: DirectorAction): DirectorAction[] {
  return Object.values(ACTIONS).filter((action) => action.href !== primary.href);
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });

    const body = (await request.json()) as DirectorChatRequest;
    const message = body.message?.trim();

    if (!message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }
    if (!body.context) {
      return Response.json({ error: "context is required" }, { status: 400 });
    }

    const workflowIntent = inferCoachJourney(message);
    const crmAnswer = workflowIntent ? null : await findClientCaseAnswer(supabase, user.id, message);
    const communicationRequest = workflowIntent ? null : inferClientCommunicationRequest(message);
    const isSellerListing = workflowIntent?.slug === "mandat-vendeur";
    const isBuyerCase = workflowIntent?.slug === "dossier-acheteur";
    const reply = crmAnswer?.reply || (workflowIntent
      ? isSellerListing
        ? "Parfait. Je vais préparer une vraie inscription vendeur avec toi. Commence avec les documents si tu les as; sinon, donne-moi seulement les informations du client."
        : `J’ai reconnu le parcours « ${workflowIntent.title} ». ${workflowIntent.summary} Je te guiderai étape par étape et je demanderai uniquement les informations manquantes.`
      : communicationRequest
        ? formatClientCommunication(generateClientCommunication(communicationRequest))
        : await generateDirectorReply(message, body.history || [], body.context));
    const action = crmAnswer?.action || (workflowIntent
      ? isSellerListing
        ? { label: "Créer mon inscription vendeur", href: "/tableau-de-bord/inscriptions/nouvelle" }
        : isBuyerCase
          ? { label: "Créer mon dossier acheteur", href: "/tableau-de-bord/acheteurs/nouveau" }
        : { label: `Ouvrir : ${workflowIntent.title}`, href: `/tableau-de-bord/parcours/${workflowIntent.slug}` }
      : buildPrimaryAction(body.context));
    const secondaryActions = workflowIntent || crmAnswer ? [] : buildSecondaryActions(action);
    return Response.json({ reply, action, secondaryActions } satisfies DirectorChatResponse);
  } catch (error) {
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) {
      return Response.json(
        { error: openAIError.body.error, diagnostic: openAIError.body.diagnostic },
        { status: openAIError.status },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function findClientCaseAnswer(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, message: string): Promise<{ reply: string; action: DirectorAction } | null> {
  const normalizedMessage = normalizeLookup(message);
  const { data: clients } = await supabase.from("clients").select("id,first_name,last_name,email,phone").eq("user_id", userId);
  const client = (clients || []).find((item) => {
    const fullName = normalizeLookup(`${item.first_name} ${item.last_name}`);
    return fullName.length >= 4 && normalizedMessage.includes(fullName);
  });
  if (!client) return null;

  const { data: links } = await supabase.from("client_case_clients").select("case_id").eq("user_id", userId).eq("client_id", client.id);
  const caseIds = Array.from(new Set((links || []).map((item) => item.case_id)));
  if (!caseIds.length) return { reply: `${client.first_name} ${client.last_name} a une fiche CRM, mais aucun dossier n’est encore relié. La prochaine meilleure action est de qualifier son projet.`, action: { label: "Ouvrir la fiche client", href: `/tableau-de-bord/clients/${client.id}` } };

  const { data: cases } = await supabase.from("client_cases").select("id,title,case_type,pipeline_stage,next_action,updated_at").eq("user_id", userId).in("id", caseIds).order("updated_at", { ascending: false }).limit(1);
  const clientCase = cases?.[0];
  if (!clientCase) return null;
  const missing = [!client.phone ? "son téléphone" : "", !client.email ? "son courriel" : ""].filter(Boolean);
  if (clientCase.case_type === "buyer" || clientCase.case_type === "buy_sell") {
    const { data: buyer } = await supabase.from("buyer_cases").select("budget,sectors,property_type,timeline,preapproval_status").eq("user_id", userId).eq("client_case_id", clientCase.id).maybeSingle();
    if (!buyer?.sectors?.length) missing.push("ses secteurs");
    if (!buyer?.property_type) missing.push("le type de propriété");
    if (!buyer?.timeline) missing.push("son échéancier");
  }
  const name = `${client.first_name} ${client.last_name}`.trim();
  const missingText = missing.length ? ` Il manque encore ${joinNatural(missing)}.` : " Les renseignements essentiels sont présents.";
  return { reply: `${name} est à l’étape « ${String(clientCase.pipeline_stage).replace(/_/g, " ")} » dans ${clientCase.title}.${missingText} La prochaine meilleure action est : ${clientCase.next_action || "continuer le dossier"}.`, action: { label: clientCase.next_action || "Continuer le dossier", href: `/tableau-de-bord/dossiers/${clientCase.id}#a-completer` } };
}

function normalizeLookup(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function joinNatural(items: string[]) { return items.length < 2 ? items[0] || "" : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`; }

function buildMentorBrief(context: DirectorChatContext, inspiration: string) {
  let observation: string;
  let analysis: string;
  let recommendation: string;

  const activitySnapshot = `${context.userName || "Sonia"}, aujourd'hui tu as ${context.prospectsCreatedToday} prospect${context.prospectsCreatedToday > 1 ? "s" : ""} créé${context.prospectsCreatedToday > 1 ? "s" : ""}, ${context.callsCompletedToday} appel${context.callsCompletedToday > 1 ? "s" : ""} effectué${context.callsCompletedToday > 1 ? "s" : ""}, ${context.overdueFollowups} suivi${context.overdueFollowups > 1 ? "s" : ""} en retard, ${context.appointmentsToday} rendez-vous aujourd'hui et ${context.appointmentsTomorrow} demain. Le pipeline compte ${context.buyerPipeline} acheteur${context.buyerPipeline > 1 ? "s" : ""}, ${context.sellerPipeline} vendeur${context.sellerPipeline > 1 ? "s" : ""}, ${context.buyerSellerContacts || 0} client${(context.buyerSellerContacts || 0) > 1 ? "s" : ""} acheteur-vendeur et ${context.investorContacts || 0} investisseur${(context.investorContacts || 0) > 1 ? "s" : ""}.`;

  if ((context.birthdayMessagesSentToday || 0) > 0 || (context.birthdayMessagesBlockedToday || 0) > 0) {
    observation = `${activitySnapshot} ${context.birthdayMessagesSentToday || 0} message${(context.birthdayMessagesSentToday || 0) > 1 ? "s d’anniversaire ont" : " d’anniversaire a"} été envoyé ce matin. ${context.birthdayMessagesBlockedToday || 0} contact${(context.birthdayMessagesBlockedToday || 0) > 1 ? "s n’ont" : " n’a"} pas été joint, dont ${context.birthdayMissingEmailsToday || 0} sans courriel valide.`;
    analysis = "L’automatisation relationnelle fonctionne, tandis que les contacts bloqués indiquent exactement quelles fiches doivent être complétées.";
    recommendation = (context.birthdayMessagesBlockedToday || 0) > 0
      ? "Complète d’abord les courriels ou consentements manquants des anniversaires du jour."
      : "Poursuis avec la prochaine action prioritaire de ton pipeline.";
  } else if (context.callsCompletedToday > 0 && ((context.callsAnsweredToday || 0) > 0 || (context.callFollowupsCreatedToday || 0) > 0)) {
    observation = `${activitySnapshot} Parmi ces appels, ${context.callsAnsweredToday || 0} propriétaire${(context.callsAnsweredToday || 0) > 1 ? "s ont" : " a"} répondu, ${context.messagesLeftToday || 0} message${(context.messagesLeftToday || 0) > 1 ? "s ont" : " a"} été laissé (${context.callResponseRateToday || 0} % de réponse), ${context.callFollowupsCreatedToday || 0} suivi${(context.callFollowupsCreatedToday || 0) > 1 ? "s ont" : " a"} été créé et ${context.appointmentsObtainedFromCallsToday || 0} rendez-vous ${(context.appointmentsObtainedFromCallsToday || 0) > 1 ? "ont" : "a"} été obtenu.`;
    analysis = "Les résultats enregistrés indiquent où une conversation est déjà engagée; les rappels demandés doivent passer avant une nouvelle séquence de prospection.";
    recommendation = context.nextCallbackName
      ? `Rappelle maintenant ${context.nextCallbackName}${context.nextCallbackDate ? ` au moment prévu le ${context.nextCallbackDate}` : ""}.`
      : "Commence par le suivi issu de l'appel le plus récent.";
  } else if ((context.automationsReadyToday || 0) > 0 || (context.mortgageRenewalsWithin90Days || 0) > 0) {
    observation = `${activitySnapshot} Tu as ${context.automationsReadyToday || 0} communication${(context.automationsReadyToday || 0) > 1 ? "s" : ""} prête${(context.automationsReadyToday || 0) > 1 ? "s" : ""}, ${context.mortgageRenewalsWithin90Days || 0} renouvellement${(context.mortgageRenewalsWithin90Days || 0) > 1 ? "s" : ""} hypothécaire${(context.mortgageRenewalsWithin90Days || 0) > 1 ? "s" : ""} à moins de 90 jours et ${context.automationsBlocked || 0} contact${(context.automationsBlocked || 0) > 1 ? "s" : ""} bloqué${(context.automationsBlocked || 0) > 1 ? "s" : ""} par des données ou consentements manquants.`;
    analysis = "Les suivis hypothécaires proches demandent une validation humaine rapide; les communications restent préparées dans l'application et aucun envoi externe n'est effectué.";
    recommendation = (context.mortgageRenewalsWithin90Days || 0) > 0
      ? "Valide d'abord les suivis hypothécaires à moins de 90 jours."
      : "Ouvre les automatisations prêtes et valide la plus urgente.";
  } else if (context.appointmentsToday > 0 && context.pendingMarketAnalyses > 0) {
    observation = `${activitySnapshot} ${context.pendingMarketAnalyses} analyse${context.pendingMarketAnalyses > 1 ? "s" : ""} de marché attend${context.pendingMarketAnalyses > 1 ? "ent" : ""} encore.`;
    analysis = "Un rendez-vous vendeur sans analyse finalisée réduit ta capacité à défendre le prix et à guider la décision pendant la rencontre.";
    recommendation = "Finalise maintenant l'analyse liée au prochain rendez-vous d'aujourd'hui.";
  } else if (context.appointmentsTomorrow > 0 && context.pendingMarketAnalyses > 0) {
    observation = `${activitySnapshot} ${context.pendingMarketAnalyses} analyse${context.pendingMarketAnalyses > 1 ? "s" : ""} de marché reste${context.pendingMarketAnalyses > 1 ? "nt" : ""} à terminer.`;
    analysis = "Préparer l'analyse la veille libère ton attention pour la stratégie de rencontre et évite une préparation précipitée demain.";
    recommendation = "Termine d'abord l'analyse du premier rendez-vous vendeur de demain.";
  } else if (context.overdueFollowups > 0) {
    observation = activitySnapshot;
    analysis = "Les suivis en retard concernent des relations déjà engagées; leur valeur commerciale décroît pendant que l'attente augmente.";
    recommendation = "Rappelle maintenant le prospect dont le suivi est le plus ancien.";
  } else if (context.informationRequests > 0) {
    const example = context.informationRequestExample;
    observation = `Tu as ${context.informationRequests} demande${context.informationRequests > 1 ? "s" : ""} d'information non traitée${context.informationRequests > 1 ? "s" : ""}${example ? `, dont celle de ${example.name} pour ${example.address}` : ""}.`;
    analysis = "Une demande entrante perd rapidement de sa valeur quand la première conversation tarde; elle est déjà plus engagée qu'un contact froid.";
    recommendation = example ? `Réponds maintenant à ${example.name} et termine par une question sur son projet et son échéancier.` : "Réponds maintenant à la demande la plus récente et termine par une question sur le projet et l'échéancier.";
  } else if (context.sellerAppointmentsToPrepare > 0) {
    observation = `${activitySnapshot} Tu as ${context.sellerAppointmentsToPrepare} rendez-vous vendeur${context.sellerAppointmentsToPrepare > 1 ? "s" : ""} à préparer et ${context.marketAnalysesToPrepare} analyse${context.marketAnalysesToPrepare > 1 ? "s" : ""} de marché à finaliser.`;
    analysis = "La confiance du vendeur se gagne lorsque tes comparables mènent à une recommandation claire, pas lorsqu'ils restent une accumulation de données.";
    recommendation = "Prépare d'abord le prochain rendez-vous avec une fourchette défendable et une décision précise à faire prendre au vendeur.";
  } else if (context.followupsDue > 0) {
    observation = `${activitySnapshot} Tu as ${context.followupsDue} suivi${context.followupsDue > 1 ? "s" : ""} en attente et ${context.callsToMake} appel${context.callsToMake > 1 ? "s" : ""} prévu${context.callsToMake > 1 ? "s" : ""}.`;
    analysis = "Un suivi protège une relation déjà amorcée; le reporter coûte généralement plus cher que démarrer une nouvelle conversation.";
    recommendation = "Commence par le suivi le plus ancien avec un rappel du contexte, une information utile et une prochaine étape simple.";
  } else if (context.marketAnalysesToPrepare > 0) {
    observation = `${activitySnapshot} Tu as ${context.marketAnalysesToPrepare} analyse${context.marketAnalysesToPrepare > 1 ? "s" : ""} de marché incomplète${context.marketAnalysesToPrepare > 1 ? "s" : ""} avant tes prochaines actions commerciales.`;
    analysis = "Une analyse inachevée ralentit la décision du client et réduit ta capacité à défendre un positionnement de prix.";
    recommendation = "Finalise l'analyse la plus urgente et formule sa recommandation en une phrase avant de passer à autre chose.";
  } else if (context.callsToMake > 0 || context.radarProspectsToCall > 0) {
    observation = `${activitySnapshot} Tu as ${context.callsToMake} appel${context.callsToMake > 1 ? "s" : ""} planifié${context.callsToMake > 1 ? "s" : ""} et ${context.radarProspectsToCall} prospect${context.radarProspectsToCall > 1 ? "s" : ""} Radar prêt${context.radarProspectsToCall > 1 ? "s" : ""} à être contacté${context.radarProspectsToCall > 1 ? "s" : ""}.`;
    analysis = "Ton pipeline progresse lorsque chaque appel clarifie une motivation, un échéancier ou une prochaine permission; la préparation seule ne produit aucun de ces signaux.";
    recommendation = "Fais maintenant le premier appel et note immédiatement la motivation, l'échéancier et la prochaine étape obtenue.";
  } else if (context.totalProspects === 0) {
    observation = `${activitySnapshot} Aucun prospect réel n'est actuellement disponible pour une prochaine action.`;
    analysis = "Sans volume minimal de conversations, tu ne peux ni mesurer ton approche ni créer assez d'occasions pour obtenir un mandat.";
    recommendation = "Ajoute tes cinq premiers prospects, puis appelle le premier sans attendre de perfectionner ton script.";
  } else {
    observation = `${activitySnapshot} Ton pipeline contient ${context.totalProspects} prospect${context.totalProspects > 1 ? "s" : ""}, sans urgence commerciale détectée aujourd'hui.`;
    analysis = "L'absence d'urgence est le meilleur moment pour faire avancer volontairement le dossier le plus proche d'une décision.";
    recommendation = "Choisis le prospect le plus avancé et fixe avec lui une prochaine étape datée.";
  }

  return [
    `Observation — ${observation}`,
    `Analyse — ${analysis}`,
    `Recommandation — ${recommendation}`,
    `Inspiration — ${inspiration}`,
  ].join("\n");
}

function enforceMentorStructure(reply: string, fallback: string) {
  const normalized = reply.replace(/\r/g, "").trim();
  const match = normalized.match(
    /Observation\s*[—:-]\s*([\s\S]*?)\s*Analyse\s*[—:-]\s*([\s\S]*?)\s*Recommandation\s*[—:-]\s*([\s\S]*?)\s*Inspiration\s*[—:-]\s*([\s\S]*)/i,
  );
  if (!match) return fallback;

  const sections = match.slice(1, 5).map((section) => section.replace(/\s+/g, " ").trim());
  if (sections.some((section) => !section)) return fallback;
  return [
    `Observation — ${sections[0]}`,
    `Analyse — ${sections[1]}`,
    `Recommandation — ${sections[2]}`,
    `Inspiration — ${sections[3]}`,
  ].join("\n");
}

async function generateDirectorReply(message: string, history: DirectorChatTurn[], context: DirectorChatContext) {
  const userName = context.userName || "Sonia";
  const selectedMessage = selectDirectorMessage({ userMessage: message, context });
  const mentorBrief = buildMentorBrief(context, selectedMessage.text);

  const contextSummary = `
- Demandes d'information non traitées : ${context.informationRequests}${
    context.informationRequestExample ? ` (ex. ${context.informationRequestExample.name}, ${context.informationRequestExample.address})` : ""
  }
- Rendez-vous vendeurs à préparer : ${context.sellerAppointmentsToPrepare}
- Suivis dus : ${context.followupsDue}
- Analyses de marché à finaliser : ${context.marketAnalysesToPrepare}
- Prospects Radar à appeler : ${context.radarProspectsToCall}
- Appels à faire : ${context.callsToMake}
- Documents vendeur manquants : ${context.mandatesWithMissingDocuments}
- Actions marketing à générer : ${context.marketingActionsToGenerate}
- Nombre total de prospects actifs : ${context.totalProspects}
- Prospects créés aujourd'hui : ${context.prospectsCreatedToday}
- Appels effectués aujourd'hui : ${context.callsCompletedToday}
- Propriétaires ayant répondu aujourd'hui : ${context.callsAnsweredToday || 0}
- Messages laissés aujourd'hui : ${context.messagesLeftToday || 0}
- Taux de réponse aujourd'hui : ${context.callResponseRateToday || 0} %
- Suivis créés après appel aujourd'hui : ${context.callFollowupsCreatedToday || 0}
- Rendez-vous obtenus après appel aujourd'hui : ${context.appointmentsObtainedFromCallsToday || 0}
- Prochain rappel prioritaire : ${context.nextCallbackName || "aucun"}${context.nextCallbackDate ? ` (${context.nextCallbackDate})` : ""}
- Suivis en retard : ${context.overdueFollowups}
- Rendez-vous aujourd'hui : ${context.appointmentsToday}
- Rendez-vous demain : ${context.appointmentsTomorrow}
- Analyses de marché en attente : ${context.pendingMarketAnalyses}
- Nouveaux contacts aujourd'hui : ${context.newContacts}
- Pipeline acheteurs : ${context.buyerPipeline}
- Pipeline vendeurs : ${context.sellerPipeline}
- Clients acheteurs et vendeurs : ${context.buyerSellerContacts || 0}
- Investisseurs : ${context.investorContacts || 0}
- Fiches multirôles détectées : ${context.multiRoleContacts || 0}
- Automatisations prêtes aujourd'hui : ${context.automationsReadyToday || 0}
- Automatisations bloquées par données ou consentement : ${context.automationsBlocked || 0}
- Renouvellements hypothécaires à moins de 90 jours : ${context.mortgageRenewalsWithin90Days || 0}
- Interventions humaines requises pour les automatisations : ${context.automationHumanInterventions || 0}
  `.trim();

  const priorityRules = `Ordre de priorité officiel de l'agence, du plus urgent au moins urgent :
1. Demande d'information non traitée -> créer le prospect et préparer le premier appel.
2. Rendez-vous vendeur prévu -> préparer le rendez-vous / l'évaluation.
3. Suivis dus -> les compléter avant tout le reste.
4. Analyse de marché à terminer -> la finaliser avant le prochain rendez-vous.
5. Sinon -> prospecter (Radar).`;

  const systemPrompt = `Tu es le Coach IA des opérations d'IACourtier, une agence immobilière au Québec. Tu n'es PAS un assistant généraliste et tu ne dois jamais répondre comme ChatGPT. Tu es le coach d'agence de ${userName}, un courtier immobilier.

Ton style :
- Professionnel, direct, orienté action.
- Toujours en français, jamais en anglais.
- Jamais "en tant qu'IA" ni "je suis un assistant" : tu es un coach d'agence.
- Maximum 6 lignes, concret et actionnable.
- Chaque réponse contient exactement quatre lignes, dans cet ordre : "Observation —", "Analyse —", "Recommandation —", "Inspiration —".
- Observation décrit uniquement les chiffres et faits réels du contexte.
- Analyse explique l'enjeu commercial ou comportemental précis.
- Recommandation contient UNE seule action prioritaire, jamais une liste.
- Inspiration reprend le message sélectionné dans la bibliothèque, sans citation inventée ni attribution à une personnalité.
- Tu t'appuies UNIQUEMENT sur le contexte réel fourni ci-dessous, jamais sur des suppositions.
- Tu ne modifies aucune donnée toi-même : tu conseilles seulement, tu ne dis jamais avoir exécuté une action.
- Tu respectes l'ordre de priorité officiel de l'agence ci-dessous quand tu recommandes une action.

${priorityRules}

Message de coaching sélectionné dans la bibliothèque interne (référence ${selectedMessage.id}, ${selectedMessage.discipline}, humeur ${selectedMessage.mood}). Tu dois t'en servir comme ancrage concret et préserver son conseil principal :
"${selectedMessage.text}"

Contexte actuel de l'agence pour ${userName} :
${contextSummary}`;

  const historyText = history
    .slice(-8)
    .map((turn) => `${turn.role === "user" ? userName : "Coach IA"} : ${turn.content}`)
    .join("\n");

  const userPrompt = `${historyText ? `Historique récent de la conversation :\n${historyText}\n\n` : ""}Nouveau message de ${userName} : "${message}"

Réponds directement à ${userName}, comme le ferait un coach d'agence immobilière expérimenté qui connaît son dossier. Respecte exactement les quatre lignes obligatoires et ne donne qu'une seule recommandation. Ne réponds jamais de façon générique.`;

  const reply = await generateWithOpenAI({
    systemPrompt,
    userPrompt,
    maxTokens: 300,
    temperature: 0.6,
  });

  return enforceMentorStructure(reply, mentorBrief);
}
