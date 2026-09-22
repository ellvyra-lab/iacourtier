export type CoachContext = {
  current_client_id: string | null;
  current_case_id: string | null;
  current_property_id: string | null;
  current_document_id: string | null;
  current_task_id: string | null;
  current_pipeline_stage: string | null;
  current_account_id?: string | null;
  current_email_id?: string | null;
  current_thread_id?: string | null;
  current_event_id?: string | null;
  current_slot?: { start: string; end: string } | null;
  current_action_id?: string | null;
};
export const emptyCoachContext = (): CoachContext => ({ current_client_id: null, current_case_id: null, current_property_id: null, current_document_id: null, current_task_id: null, current_pipeline_stage: null });
export type CoachCard = { kind: "client" | "case" | "property" | "task" | "document" | "email" | "event"; id: string; title: string; detail?: string; href: string; phone?: string };
export type CoachActionRequest = { id: string; mode: "confirm" | "cancel" | "edit"; subject?: string; message?: string };
export type CoachReply = { text: string; cards: CoachCard[]; context: CoachContext; choices?: { id: string; label: string }[]; navigate?: string; draft?: { recipient: string; subject: string; message: string }; approval?: { id: string; label: string; kind: string }; changed?: boolean };
export type CoachMessage = { id: string; text: string; reply: CoachReply | null };
export const coachTools = {
  search_clients: "Chercher une personne, ou les acheteurs/vendeurs (role).",
  search_crm: "Chercher un dossier par son adresse ou titre, ou les dossiers urgents/manquants (filter).",
  get_client: "Lire ou ouvrir le client courant.",
  get_case: "Lire ou ouvrir le dossier courant, éventuellement buyer/seller dans caseType.",
  get_property: "Lire la propriété du dossier.",
  update_property: "Modifier la propriété du dossier via values={address,city,postalCode,propertyType,lotNumber}. Ne pas confondre avec l'adresse personnelle du client.",
  get_tasks: "Lire les tâches. filter=today|overdue|calls|all. Sans personne nommée, toutes les tâches de l'utilisateur.",
  get_documents: "Lister les documents du dossier.",
  get_pipeline: "Lire l'étape du dossier.",
  get_missing_information: "Lire les renseignements et documents manquants du dossier.",
  get_next_best_action: "Lire la prochaine action du dossier.",
  create_client: "Ajouter un client et son projet, ses critères et les rappels explicitement demandés. Transmettre le texte original dans capture.",
  create_case: "Ajouter un projet à un client connu, capture = texte original.",
  update_client: "Modifier téléphone/courriel/adresse via values={phone,email,mailingAddress,city,notes}. Ajouter un rôle via create_case.",
  create_note: "Ajouter une note à la fiche et au dossier courant, contenu dans capture.",
  update_case: "Modifier critères acheteur via values={budget,sectors,addSectors,removeSectors,bedrooms,importantNeeds,propertyType,prequalified}. Aucune valeur non demandée.",
  create_task: "Créer une tâche: title obligatoire et dateExpression (expression originale de date). Si demande explicite de toutes les tâches manquantes: filter=missing.",
  update_task: "Reporter/modifier une tâche résolue par taskQuery ou contexte, title/dateExpression.",
  complete_task: "Terminer une tâche résolue par taskQuery ou contexte.",
  update_pipeline_stage: "Changer l'étape via pipelineStage.",
  draft_email: "Préparer un brouillon sans envoyer: subject et instruction dans capture.",
  search_emails: "Chercher courriels (query=nom/adresse/mots exacts). Réponse de Jacques → search_emails,query=Jacques.",
  get_email: "Lire et résumer le courriel courant; query seulement si nouvelle recherche explicite.",
  get_email_thread: "Résumer le fil courant, ou ce qu’il dit/veut. query si nouvelle recherche.",
  get_unread_emails: "Lister courriels non lus.",
  get_recent_emails: "Courriels récents.",
  get_email_attachments: "Lister les pièces jointes du courriel courant.",
  reply_email: "Préparer une réponse au courriel courant. capture=instruction utilisateur. Jamais envoyer directement.",
  send_email: "Confirmer l’aperçu courant uniquement lorsque le message dit explicitement Envoie/Confirme.",
  find_emails_needing_reply: "Analyser les fils récents et demandes sans réponse.",
  daily_brief: "Topo depuis hier, ce qui presse, oubli de quelqu’un ou priorité de la journée.",
  get_calendar: "Agenda aujourd’hui/demain/semaine; dateExpression=expression de date originale.",
  search_calendar: "Chercher rendez-vous, query=nom ou lieu, dateExpression=période.",
  check_availability: "Vérifier disponibilité, dateExpression=jour et heure/plage originale.",
  create_calendar_event: "Préparer rendez-vous avec confirmation, title et dateExpression. values.location si lieu explicite.",
  update_calendar_event: "Préparer déplacement du rendez-vous courant ou cherché par query, dateExpression=nouvelle date/heure.",
  delete_calendar_event: "Préparer suppression du rendez-vous courant; confirmation obligatoire.",
  conditional_followup: "Suivi daté s’il ne répond pas. title et dateExpression, lié au fil courant, sans surveillance automatique.",
  search_everywhere: "Tout ce qui concerne query dans CRM, propriétés, tâches, courriels et agenda.",
  phone_call: "Afficher le numéro du client et le lien pour appeler. Aucun appel automatique.",
  unavailable: "Fonction non branchée (SMS, marketing, import, etc.) ou demande incomprise. explanation courte et honnête.",
} as const;
export type CoachTool = keyof typeof coachTools;
export type CoachIntent = { tool: CoachTool; query?: string; caseType?: string; role?: string; filter?: string; title?: string; taskQuery?: string; dateExpression?: string; pipelineStage?: string; capture?: string; subject?: string; explanation?: string; open?: boolean; values?: Record<string, unknown> };
export function parseCoachIntent(input: unknown): CoachIntent {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Je n’ai pas compris la demande. Peux-tu la reformuler ?");
  const obj = input as Record<string, unknown>;
  if (typeof obj.tool !== "string" || !Object.hasOwn(coachTools, obj.tool)) throw new Error("Cette action n’est pas disponible.");
  const result: CoachIntent = { tool: obj.tool as CoachTool };
  for (const key of ["query", "caseType", "role", "filter", "title", "taskQuery", "dateExpression", "pipelineStage", "capture", "subject", "explanation"] as const) {
    if (obj[key] !== undefined && obj[key] !== null) { if (typeof obj[key] !== "string" || obj[key].length > 12000) throw new Error("Paramètre de conversation invalide."); result[key] = obj[key].trim(); }
  }
  if (obj.open !== undefined && obj.open !== null && typeof obj.open !== "boolean") throw new Error("Navigation invalide.");
  result.open = obj.open === true;
  if (obj.values !== undefined && obj.values !== null) { if (typeof obj.values !== "object" || Array.isArray(obj.values)) throw new Error("Valeurs invalides."); result.values = Object.fromEntries(Object.entries(obj.values).filter(([,value]) => value !== null)); }
  return result;
}
export function coachLink(kind: CoachCard["kind"], id: string, caseId?: string | null) {
  const safe = encodeURIComponent(id);
  const base = "/tableau-de-bord";
  if (kind === "email" || kind === "event") return `${base}/coach?reference=${safe}`;
  const routes = { client: `${base}/clients/${safe}`, case: `${base}/dossiers/${safe}`, property: `${base}/proprietes/${safe}`, task: `${base}/taches/${safe}`, document: caseId ? `${base}/dossiers/${encodeURIComponent(caseId)}#document-${safe}` : `${base}/telechargements?document=${safe}` };
  return routes[kind];
}
export function selectCoachClient(context: CoachContext, clientId: string): CoachContext {
  return context.current_client_id === clientId ? context : { ...emptyCoachContext(), current_client_id: clientId };
}
export function foldCoach(value: unknown) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

/** Reserved contracts for capabilities outside the connected assistant. */
export type FutureCoachTool = "marketing" | "prospection" | "universal_import" | "property_verification" | "centris_preparation" | "SMS" | "client_portal";
export type FutureCoachAction = { tool: FutureCoachTool; available: false; requiresConfirmation: boolean };
