import { normalizeSalesStyle } from "./styles";
import type { CallCoachInput, CallCoachSuggestion } from "./types";

export function coachSalesCall(input: CallCoachInput): CallCoachSuggestion {
  const note = input.note.trim();
  const lowerNote = note.toLowerCase();
  const style = normalizeSalesStyle(input.style);
  const city = input.prospect?.city || "son secteur";

  const askedForAppointment = /rendez-vous|rencontre|appel|évaluation|estimation/.test(lowerNote);
  const askedOpenQuestion = /\?|comment|qu'est-ce|pourquoi|depuis quand|si vous/i.test(note);
  const objection = detectObjection(lowerNote);

  return {
    whatCouldBeBetter: askedOpenQuestion
      ? "Bonne ouverture : vous avez créé une conversation. La prochaine amélioration serait de réduire l'explication et de demander une micro-permission pour l'évaluation."
      : "Ajoutez plus vite une question ouverte. Le propriétaire doit parler de son contexte avant que vous présentiez vos services.",
    nextQuestion: objection
      ? objection.nextQuestion
      : "Si vous aviez une valeur claire et actuelle en main, qu'est-ce que ça vous permettrait de décider pour la suite?",
    nextFollowUp: askedForAppointment
      ? "Envoyez une confirmation courte avec deux plages horaires et la promesse d'un portrait simple du marché."
      : "Relancez avec une invitation précise : un appel de 10 minutes pour valider la valeur et les options possibles.",
    bestReentryAngle:
      style === "Luxe"
        ? `Reprenez contact avec un angle confidentiel : positionnement réel de la propriété dans ${city}, sans engagement.`
        : `Reprenez contact avec un angle utile : une lecture simple des ventes récentes dans ${city} et des options possibles.`,
  };
}

function detectObjection(note: string) {
  if (note.includes("attendre")) {
    return { nextQuestion: "Qu'est-ce qui vous ferait dire que le moment est bon pour regarder vos options?" };
  }

  if (note.includes("courtier")) {
    return { nextQuestion: "Est-ce que votre courtier vous a préparé une mise à jour de valeur récemment?" };
  }

  if (note.includes("courriel")) {
    return { nextQuestion: "Est-ce que votre curiosité porte plutôt sur la valeur, le délai de vente ou les options possibles?" };
  }

  if (note.includes("pas vendre") || note.includes("ne veux pas vendre")) {
    return { nextQuestion: "Si vous aviez une valeur claire en main, est-ce que ça vous aiderait à planifier les prochaines années?" };
  }

  return null;
}
