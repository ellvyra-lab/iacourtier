import type { AiEmployee } from "./types";

export const aiEmployees: AiEmployee[] = [
  {
    id: "alex",
    name: "Alex",
    role: "Analyste marché",
    specialty: "Analyses comparatives, positionnement prix et objections vendeur.",
  },
  {
    id: "emma",
    name: "Emma",
    role: "Coordonnatrice documents",
    specialty: "Certificat, taxes, acte, déclaration vendeur et validation du dossier.",
  },
  {
    id: "noah",
    name: "Noah",
    role: "Coach rendez-vous",
    specialty: "Questions vendeur, qualification acheteur et préparation des rencontres.",
  },
  {
    id: "mia",
    name: "Mia",
    role: "Marketing immobilier",
    specialty: "Description, Facebook, Instagram, TikTok et contenu de lancement.",
  },
  {
    id: "olivia",
    name: "Olivia",
    role: "Suivis clients",
    specialty: "Relances, prochaines étapes, notaire et suivi après-vente.",
  },
];

export function getEmployeeName(id: AiEmployee["id"]) {
  return aiEmployees.find((employee) => employee.id === id)?.name || "IACourtier";
}
