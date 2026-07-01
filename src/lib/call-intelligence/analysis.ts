import { scoreClosing, scoreConnection, scoreDiscovery, scoreObjectionHandling } from "./scoring";
import type { CallAnalysis, CallRecording } from "./types";

const objectionPatterns = [
  "je ne veux pas vendre",
  "je vais attendre",
  "j'ai déjà un courtier",
  "je veux vendre moi-même",
  "je veux juste connaître la valeur",
  "marché est incertain",
  "envoyez-moi ça par courriel",
  "je ne veux pas être dérangé",
  "on n'est pas pressés",
  "duproprio",
];

export function analyzeCallTranscript(call: Pick<CallRecording, "id" | "transcript" | "duration">): CallAnalysis {
  const transcript = call.transcript || "";
  const lower = transcript.toLowerCase();
  const questionsAsked = (transcript.match(/\?/g) || []).length + countMatches(lower, /(est-ce que|avez-vous|voulez-vous|qu'est-ce|comment|pourquoi|quand)/g);
  const openQuestionsCount = countMatches(lower, /(qu'est-ce|comment|pourquoi|quand|de quelle façon|si vous aviez|qu'est ce)/g);
  const objectionsDetected = objectionPatterns.filter((pattern) => lower.includes(pattern));
  const motivationDetected = /(déménager|agrandir|réduire|retraite|séparation|travail|famille|projet|timing|printemps|cette année)/.test(lower);
  const appointmentAskDetected = /(rendez-vous|rencontre|10 minutes|évaluation|estimation|appel cette semaine|moment cette semaine)/.test(lower);
  const nextStepDetected = /(je vous rappelle|prochaine étape|je vous envoie|on se parle|mardi|mercredi|jeudi|vendredi|semaine prochaine)/.test(lower);
  const agentLines = splitSpeakerLines(transcript, ["courtier", "agent", "sonia", "moi"]);
  const clientLines = splitSpeakerLines(transcript, ["client", "propriétaire", "vendeur", "prospect"]);
  const talkTimeRatioAgent = ratio(agentLines.join(" ").length, transcript.length, 55);
  const talkTimeRatioClient = ratio(clientLines.join(" ").length, transcript.length, 45);
  const scoreDiscoveryValue = scoreDiscovery(openQuestionsCount, motivationDetected);
  const scoreConnectionValue = scoreConnection(transcript);
  const scoreObjectionValue = scoreObjectionHandling(objectionsDetected, transcript);
  const scoreClosingValue = scoreClosing(appointmentAskDetected, nextStepDetected);
  const globalScore = Math.round((scoreDiscoveryValue + scoreConnectionValue + scoreObjectionValue + scoreClosingValue) / 4);

  return {
    callId: call.id,
    summary: buildSummary({ objectionsDetected, motivationDetected, appointmentAskDetected, nextStepDetected }),
    talkTimeRatioAgent,
    talkTimeRatioClient,
    questionsAsked,
    openQuestionsCount,
    objectionsDetected,
    motivationDetected,
    appointmentAskDetected,
    nextStepDetected,
    strengths: buildStrengths({ openQuestionsCount, motivationDetected, appointmentAskDetected, nextStepDetected }),
    weaknesses: buildWeaknesses({ openQuestionsCount, objectionsDetected, appointmentAskDetected, nextStepDetected }),
    missedOpportunities: buildMissedOpportunities({ openQuestionsCount, motivationDetected, appointmentAskDetected, nextStepDetected }),
    suggestedResponse: suggestedResponse(objectionsDetected),
    nextBestQuestion: nextBestQuestion({ motivationDetected, appointmentAskDetected }),
    recommendedFollowup: recommendedFollowup({ appointmentAskDetected, nextStepDetected }),
    clientNote: buildClientNote({ objectionsDetected, appointmentAskDetected, nextStepDetected }),
    scoreDiscovery: scoreDiscoveryValue,
    scoreConnection: scoreConnectionValue,
    scoreObjectionHandling: scoreObjectionValue,
    scoreClosing: scoreClosingValue,
    globalScore,
  };
}

function buildSummary(input: { objectionsDetected: string[]; motivationDetected: boolean; appointmentAskDetected: boolean; nextStepDetected: boolean }) {
  const parts = ["Appel de prospection analysé."];
  if (input.objectionsDetected.length) parts.push(`Objection principale : ${input.objectionsDetected[0]}.`);
  if (input.motivationDetected) parts.push("Une motivation ou un contexte de décision a été détecté.");
  if (input.appointmentAskDetected) parts.push("Le courtier a demandé un rendez-vous ou une estimation.");
  if (input.nextStepDetected) parts.push("Une prochaine étape claire est présente.");
  return parts.join(" ");
}

function buildClientNote(input: { objectionsDetected: string[]; appointmentAskDetected: boolean; nextStepDetected: boolean }) {
  const objection = input.objectionsDetected[0] ? ` Objection : ${input.objectionsDetected[0]}.` : "";
  const appointment = input.appointmentAskDetected ? " Rendez-vous ou estimation demandé." : " Aucun rendez-vous demandé clairement.";
  const nextStep = input.nextStepDetected ? " Prochaine étape à confirmer dans la timeline." : " Relance recommandée à créer.";
  return `Note d'appel Coach.${objection}${appointment}${nextStep}`;
}

function countMatches(value: string, pattern: RegExp) {
  return (value.match(pattern) || []).length;
}

function ratio(part: number, total: number, fallback: number) {
  if (!total) return fallback;
  return Math.round((part / total) * 100);
}

function splitSpeakerLines(transcript: string, labels: string[]) {
  return transcript.split(/\n+/).filter((line) => labels.some((label) => line.toLowerCase().startsWith(label)));
}

function buildStrengths(input: { openQuestionsCount: number; motivationDetected: boolean; appointmentAskDetected: boolean; nextStepDetected: boolean }) {
  const strengths = [];
  if (input.openQuestionsCount) strengths.push("Vous avez posé des questions ouvertes.");
  if (input.motivationDetected) strengths.push("Vous avez fait ressortir une motivation ou un contexte client.");
  if (input.appointmentAskDetected) strengths.push("Vous avez demandé un rendez-vous ou une estimation.");
  if (input.nextStepDetected) strengths.push("La prochaine étape est claire.");
  return strengths.length ? strengths : ["La conversation donne une base exploitable pour progresser."];
}

function buildWeaknesses(input: { openQuestionsCount: number; objectionsDetected: string[]; appointmentAskDetected: boolean; nextStepDetected: boolean }) {
  const weaknesses = [];
  if (!input.openQuestionsCount) weaknesses.push("Posez plus de questions ouvertes pour faire parler le client.");
  if (input.objectionsDetected.length) weaknesses.push("Les objections doivent être reconnues, puis ramenées vers une question.");
  if (!input.appointmentAskDetected) weaknesses.push("Vous n'avez pas clairement demandé de rendez-vous.");
  if (!input.nextStepDetected) weaknesses.push("La prochaine étape doit être plus précise.");
  return weaknesses;
}

function buildMissedOpportunities(input: { openQuestionsCount: number; motivationDetected: boolean; appointmentAskDetected: boolean; nextStepDetected: boolean }) {
  const missed = [];
  if (!input.motivationDetected) missed.push("Creuser la motivation : pourquoi maintenant, pourquoi plus tard, qu'est-ce qui changerait?");
  if (!input.appointmentAskDetected) missed.push("Transformer l'intérêt en rendez-vous d'évaluation.");
  if (!input.nextStepDetected) missed.push("Terminer avec une date, une heure ou une action concrète.");
  if (input.openQuestionsCount < 2) missed.push("Ajouter une deuxième question ouverte avant de présenter vos services.");
  return missed;
}

function suggestedResponse(objections: string[]) {
  if (objections.some((item) => item.includes("attendre"))) return "Je comprends. Qu'est-ce qui devrait changer pour que vous disiez : là, c'est le bon moment?";
  if (objections.some((item) => item.includes("courriel"))) return "Bien sûr. Pour vous envoyer quelque chose d'utile, est-ce votre valeur, le délai ou vos options qui vous intéressent le plus?";
  return "Je comprends. Si vous aviez une valeur claire en main, est-ce que ça vous aiderait à prendre une meilleure décision?";
}

function nextBestQuestion(input: { motivationDetected: boolean; appointmentAskDetected: boolean }) {
  if (!input.motivationDetected) return "Qu'est-ce qui vous ferait considérer une vente cette année?";
  if (!input.appointmentAskDetected) return "Seriez-vous ouvert à un court rendez-vous d'évaluation cette semaine?";
  return "Qui d'autre devrait être impliqué dans la prochaine étape?";
}

function recommendedFollowup(input: { appointmentAskDetected: boolean; nextStepDetected: boolean }) {
  if (input.appointmentAskDetected && input.nextStepDetected) return "Envoyer une confirmation courte avec l'heure du rendez-vous et les documents utiles.";
  if (input.appointmentAskDetected) return "Proposer deux plages horaires précises pour verrouiller le rendez-vous.";
  return "Relancer dans 48 heures avec une question simple sur la valeur ou le timing.";
}
