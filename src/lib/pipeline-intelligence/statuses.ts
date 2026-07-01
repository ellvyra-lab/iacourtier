import type { BuyerPipelineStatus, PipelineStatus, SellerPipelineStatus } from "./types";

export const sellerPipelineStatuses: SellerPipelineStatus[] = [
  "Prospect vendeur",
  "Rendez-vous obtenu",
  "Évaluation en préparation",
  "Évaluation terminée",
  "Mandat signé",
  "Préparation mise en marché",
  "En vente",
  "Promesse d'achat",
  "Conditions",
  "Notaire",
  "Vendu",
  "Suivi après-vente",
];

export const buyerPipelineStatuses: BuyerPipelineStatus[] = [
  "Prospect acheteur",
  "Qualification",
  "Contrat acheteur",
  "Recherche active",
  "Visites",
  "Promesse d'achat",
  "Conditions",
  "Notaire",
  "Suivi",
];

export function getPipelineStageIndex(status: PipelineStatus) {
  const sellerIndex = sellerPipelineStatuses.indexOf(status as SellerPipelineStatus);
  if (sellerIndex >= 0) return sellerIndex;
  return buyerPipelineStatuses.indexOf(status as BuyerPipelineStatus);
}
