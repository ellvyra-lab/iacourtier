import type { ProspectRecord } from "./types";

export function createProspectingActions(prospect: ProspectRecord) {
  const owner = prospect.contactName || "Bonjour";
  const context = `${prospect.address}, ${prospect.city}`;
  const category = prospect.category.toLowerCase();

  return {
    facebook: `${owner}, je suis de près le marché immobilier autour de ${context}. Votre propriété ressort dans une courte analyse de prospection liée à ${category}. Si vous souhaitez connaître vos options ou la valeur actuelle du marché, je peux vous préparer un portrait simple, sans pression.`,
    email: `Bonjour${prospect.contactName ? ` ${prospect.contactName}` : ""},\n\nJe vous écris parce que votre propriété située au ${context} ressort dans mon radar de prospection IA.\n\nRaison principale : ${prospect.reason}\n\nJe peux vous préparer une courte analyse de marché, claire et confidentielle, pour vous aider à comprendre vos options.\n\nSeriez-vous disponible cette semaine pour un court échange?`,
    call: `Bonjour${prospect.contactName ? ` ${prospect.contactName}` : ""}, je vous appelle au sujet de la propriété située au ${context}. Mon radar de prospection indique une opportunité potentielle : ${prospect.reason} Je ne présume pas que vous voulez vendre, mais je peux vous donner une lecture actuelle du marché en quelques minutes.`,
    sms: `Bonjour${prospect.contactName ? ` ${prospect.contactName}` : ""}, votre propriété de ${prospect.city} ressort dans une analyse de marché. Souhaitez-vous recevoir un court portrait de valeur et d'options?`,
    followUp7: `Bonjour${prospect.contactName ? ` ${prospect.contactName}` : ""}, je me permets une courte relance. Je peux vous transmettre quelques ventes récentes près de ${prospect.address} si vous voulez suivre le marché actuel.`,
    followUp30: `Bonjour${prospect.contactName ? ` ${prospect.contactName}` : ""}, je reste disponible si vous souhaitez une mise à jour de valeur ou un portrait du marché pour ${prospect.city}.`,
    objections: [
      "Nous ne voulons pas vendre maintenant.",
      "Comment avez-vous obtenu cette information?",
      "Nous ne voulons pas être sollicités.",
    ],
    responses: [
      "Je comprends très bien. L'objectif n'est pas de vous pousser à vendre, mais de vous donner une information utile pour vos décisions futures.",
      "J'utilise des listes internes et des signaux de prospection que je valide toujours avec prudence. Rien ne remplace votre contexte personnel.",
      "Je respecte ça. Je peux simplement fermer le suivi ou vous envoyer une seule page de données de marché si vous la jugez utile.",
    ],
  };
}
