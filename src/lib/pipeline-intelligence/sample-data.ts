import { createActionsForStatus } from "./triggers";
import type { PipelineClient } from "./types";

const today = "2026-07-01";

export const pipelineClients: PipelineClient[] = [
  createClient({
    id: "tremblay-repentigny",
    type: "seller",
    name: "M. Tremblay",
    address: "1240 rue Notre-Dame",
    city: "Repentigny",
    status: "Rendez-vous vendeur obtenu",
    priority: "Élevée",
    nextStep: "Préparer l'analyse de marché avant le rendez-vous vendeur.",
  }),
  createClient({
    id: "gagnon-laval",
    type: "seller",
    name: "Mme Gagnon",
    address: "2145 boulevard des Laurentides",
    city: "Laval",
    status: "Mandat vendeur signé",
    priority: "Élevée",
    nextStep: "Demander les documents et lancer la préparation marketing.",
  }),
  createClient({
    id: "bouchard-montreal",
    type: "seller",
    name: "Famille Bouchard",
    address: "4821 rue Wellington",
    city: "Montréal",
    status: "En vente",
    priority: "Moyenne",
    nextStep: "Préparer le suivi vendeur et le contenu de relance.",
  }),
  createClient({
    id: "nguyen-longueuil",
    type: "buyer",
    name: "Mme Nguyen",
    city: "Longueuil",
    status: "Recherche active",
    priority: "Moyenne",
    nextStep: "Envoyer trois propriétés alignées avec ses critères.",
  }),
  createClient({
    id: "cote-quebec",
    type: "seller",
    name: "M. Côté",
    address: "905 3e Avenue",
    city: "Québec",
    status: "Notaire",
    priority: "Élevée",
    nextStep: "Valider les derniers documents avant la signature.",
  }),
  createClient({
    id: "roy-sherbrooke",
    type: "buyer",
    name: "Mme Roy",
    city: "Sherbrooke",
    status: "Suivi après-achat",
    priority: "Faible",
    nextStep: "Relancer avec les nouvelles inscriptions de la semaine.",
  }),
  createClient({
    id: "fortin-terrebonne",
    type: "seller",
    name: "M. Fortin",
    address: "1180 croissant des Fougères",
    city: "Terrebonne",
    status: "Prospect vendeur",
    priority: "Moyenne",
    nextStep: "Créer une conversation et valider s'il existe un projet.",
  }),
];

function createClient(input: Omit<PipelineClient, "actions" | "timeline" | "updatedAt">): PipelineClient {
  const actions = createActionsForStatus(input.id, input.status, today, input.type);

  return {
    ...input,
    updatedAt: today,
    actions,
    timeline: [
      {
        id: `${input.id}-created`,
        date: today,
        title: `Statut : ${input.status}`,
        description: "IACourtier a ajusté les actions IA selon le statut actuel du client.",
        actionIds: actions.map((action) => action.id),
      },
      ...actions.map((action) => ({
        id: `${action.id}-timeline`,
        date: today,
        title: `${action.title}`,
        description: action.description,
        employeeId: action.employeeId,
        actionIds: [action.id],
      })),
    ],
  };
}
