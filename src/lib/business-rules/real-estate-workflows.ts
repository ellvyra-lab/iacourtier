export const officialSellerWorkflow = [
  "Prospection",
  "Prospect vendeur",
  "Appel / qualification",
  "Rendez-vous vendeur obtenu",
  "Préparation de l’analyse de marché",
  "Analyse de marché prête",
  "Rendez-vous vendeur effectué",
  "Mandat vendeur signé",
  "Documents vendeur à recevoir",
  "Préparation mise en marché",
  "En vente",
  "Promesse d’achat",
  "Conditions",
  "Notaire",
  "Vendu",
  "Suivi après-vente",
] as const;

export const officialBuyerWorkflow = [
  "Prospect acheteur",
  "Qualification acheteur",
  "Préautorisation demandée",
  "Contrat acheteur signé",
  "Recherche active",
  "Visites",
  "Promesse d’achat",
  "Conditions",
  "Notaire",
  "Suivi après-achat",
] as const;

export type OfficialSellerStatus = (typeof officialSellerWorkflow)[number];
export type OfficialBuyerStatus = (typeof officialBuyerWorkflow)[number];
export type OfficialWorkflowStatus = OfficialSellerStatus | OfficialBuyerStatus;
export type OfficialClientType = "vendeur" | "acheteur";

export function isSellerStatus(status: string): status is OfficialSellerStatus {
  return officialSellerWorkflow.includes(status as OfficialSellerStatus);
}

export function isBuyerStatus(status: string): status is OfficialBuyerStatus {
  return officialBuyerWorkflow.includes(status as OfficialBuyerStatus);
}

export function getWorkflowIndex(clientType: OfficialClientType, status: string) {
  const workflow = clientType === "vendeur" ? officialSellerWorkflow : officialBuyerWorkflow;
  return workflow.indexOf(status as never);
}
