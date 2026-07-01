import type { AiEmployeeId, PipelineAction, PipelineStatus } from "./types";

type TriggerTemplate = {
  employeeId: AiEmployeeId;
  title: string;
  description: string;
};

const triggerMap: Partial<Record<PipelineStatus, TriggerTemplate[]>> = {
  "Prospect vendeur": [
    { employeeId: "noah", title: "Préparer l'ouverture de conversation", description: "Créer les questions ouvertes pour valider s'il existe un projet réel." },
    { employeeId: "olivia", title: "Planifier la première relance", description: "Créer une relance naturelle si le prospect ne répond pas aujourd'hui." },
  ],
  "Rendez-vous obtenu": [
    { employeeId: "noah", title: "Préparer les questions vendeur", description: "Structurer les questions sur motivation, échéancier, prix attendu et contraintes." },
    { employeeId: "emma", title: "Préparer la liste documentaire", description: "Lister les documents à demander avant l'évaluation." },
  ],
  "Évaluation en préparation": [
    { employeeId: "alex", title: "Préparer l'analyse comparative", description: "Structurer les comparables, les ajustements qualitatifs et le positionnement." },
    { employeeId: "emma", title: "Vérifier les documents requis", description: "Identifier certificat, taxes, acte et informations manquantes." },
    { employeeId: "noah", title: "Préparer les questions vendeur", description: "Préparer les questions pour comprendre motivation, objections et échéancier." },
  ],
  "Évaluation terminée": [
    { employeeId: "alex", title: "Résumer la recommandation de prix", description: "Préparer les arguments, objections probables et stratégie de présentation." },
    { employeeId: "olivia", title: "Créer le suivi vendeur", description: "Planifier la relance post-évaluation avec prochaine étape claire." },
  ],
  "Mandat signé": [
    { employeeId: "emma", title: "Demander certificat, taxes et acte", description: "Créer la checklist documentaire et les demandes au vendeur." },
    { employeeId: "mia", title: "Préparer le contenu de lancement", description: "Préparer Facebook, Instagram, TikTok et description de propriété." },
  ],
  "Préparation mise en marché": [
    { employeeId: "mia", title: "Finaliser la description et les publications", description: "Préparer les textes de mise en marché et les angles sociaux." },
    { employeeId: "emma", title: "Valider le dossier avant publication", description: "Confirmer les informations essentielles avant la mise en ligne." },
  ],
  "En vente": [
    { employeeId: "mia", title: "Créer la séquence marketing", description: "Préparer publications, relances acheteurs et contenu vidéo." },
    { employeeId: "olivia", title: "Planifier les suivis vendeurs", description: "Créer le rythme de suivi hebdomadaire et les points de marché." },
  ],
  "Promesse d'achat": [
    { employeeId: "emma", title: "Préparer le suivi des conditions", description: "Lister inspection, financement, documents et échéances." },
    { employeeId: "olivia", title: "Préparer la communication client", description: "Créer les messages pour expliquer les prochaines étapes." },
  ],
  Conditions: [
    { employeeId: "emma", title: "Suivre les échéances de conditions", description: "Surveiller les dates critiques et documents à obtenir." },
    { employeeId: "olivia", title: "Relancer les parties", description: "Préparer les suivis pour éviter les blocages." },
  ],
  Notaire: [
    { employeeId: "emma", title: "Préparer le dossier notaire", description: "Confirmer coordonnées, documents, dates et éléments à transmettre." },
    { employeeId: "olivia", title: "Préparer le rappel client", description: "Envoyer les étapes avant signature et les informations pratiques." },
  ],
  Vendu: [
    { employeeId: "olivia", title: "Créer le suivi après transaction", description: "Préparer remerciement, demande de témoignage et rappel futur." },
    { employeeId: "mia", title: "Préparer la publication vendu", description: "Créer le contenu social de clôture de transaction." },
  ],
  "Prospect acheteur": [
    { employeeId: "noah", title: "Qualifier l'acheteur", description: "Préparer les questions budget, secteur, échéancier et financement." },
    { employeeId: "olivia", title: "Créer la première relance acheteur", description: "Planifier un suivi pour obtenir les critères précis." },
  ],
  Qualification: [
    { employeeId: "noah", title: "Structurer le profil acheteur", description: "Synthétiser besoins, contraintes, motivation et capacité d'achat." },
  ],
  "Contrat acheteur": [
    { employeeId: "emma", title: "Préparer les documents acheteur", description: "Préparer les prochaines étapes et informations contractuelles." },
  ],
  "Recherche active": [
    { employeeId: "alex", title: "Analyser les propriétés ciblées", description: "Comparer les propriétés repérées avec les critères et le marché." },
    { employeeId: "olivia", title: "Planifier les suivis de recherche", description: "Créer le rythme de suivi des nouvelles inscriptions." },
  ],
  Visites: [
    { employeeId: "noah", title: "Préparer les questions de visite", description: "Créer une grille de questions et d'observations pour chaque visite." },
  ],
  Suivi: [
    { employeeId: "olivia", title: "Créer le suivi acheteur", description: "Préparer la relance et les prochaines propriétés à proposer." },
  ],
};

export function createActionsForStatus(clientId: string, status: PipelineStatus, createdAt: string): PipelineAction[] {
  return (triggerMap[status] || []).map((trigger, index) => ({
    id: `${clientId}-${status}-${trigger.employeeId}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    employeeId: trigger.employeeId,
    title: trigger.title,
    description: trigger.description,
    status: index === 0 ? "En cours" : "À faire",
    createdAt,
  }));
}
