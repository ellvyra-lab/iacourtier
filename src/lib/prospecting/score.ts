import type { ProspectingCategory, ProspectingPriority } from "./types";

export function clampOpportunityScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function priorityFromScore(score: number): ProspectingPriority {
  if (score >= 75) return "Élevée";
  if (score >= 50) return "Moyenne";
  return "Faible";
}

export function calculateOpportunityScore({
  category,
  propertyType,
  notes,
}: {
  category: string;
  propertyType: string;
  notes?: string;
}) {
  const searchable = `${category} ${propertyType} ${notes || ""}`.toLowerCase();
  let score = 35;

  if (searchable.includes("longue") || searchable.includes("plus de") || searchable.includes("10 ans") || searchable.includes("15 ans") || searchable.includes("20 ans")) score += 20;
  if (searchable.includes("terrain")) score += 15;
  if (searchable.includes("succession")) score += 20;
  if (searchable.includes("expir")) score += 15;
  if (searchable.includes("divorce")) score += 15;
  if (searchable.includes("reprise") || searchable.includes("finance")) score += 15;
  if (searchable.includes("plex") || searchable.includes("duplex") || searchable.includes("triplex") || searchable.includes("multiplex")) score += 12;
  if (searchable.includes("investisseur") || searchable.includes("revenu")) score += 12;
  if (searchable.includes("forte équité") || searchable.includes("equite") || searchable.includes("équité")) score += 15;
  if (searchable.includes("urgent") || searchable.includes("motivé") || searchable.includes("motivé")) score += 10;

  return clampOpportunityScore(score);
}

export function normalizeCategory(value: string): ProspectingCategory {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("succession")) return "Successions";
  if (normalized.includes("divorce")) return "Divorces";
  if (normalized.includes("expir")) return "Propriétés expirées";
  if (normalized.includes("reprise") || normalized.includes("finance")) return "Reprises de finance";
  if (normalized.includes("équité") || normalized.includes("equite")) return "Propriétés à forte équité";
  if (normalized.includes("propriétaire") || normalized.includes("longue")) return "Propriétaires de plus de X années";
  if (normalized.includes("terrain")) return "Terrains";
  if (normalized.includes("plex")) return "Multiplex";
  if (normalized.includes("invest")) return "Opportunités investisseurs";
  if (normalized.includes("vendeur")) return "Vendeurs potentiels";
  return "Import CSV";
}
