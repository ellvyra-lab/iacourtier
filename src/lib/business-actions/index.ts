import { getAllContextualAiActions, getContextualAiActionById, type ContextualAiAction } from "@/lib/ai-actions";

export type BusinessActionRunInput = {
  actionId: string;
  context?: Record<string, string>;
};

export type BusinessActionServiceResult = {
  slug: string;
  label: string;
  output: string;
};

export type BusinessActionRunResult = {
  action: ContextualAiAction;
  results: BusinessActionServiceResult[];
};

export function getBusinessActions() {
  return getAllContextualAiActions();
}

export function getBusinessAction(id: string) {
  return getContextualAiActionById(id);
}

export function buildBusinessActionPrompt(action: ContextualAiAction, context?: Record<string, string>) {
  const contextLines = Object.entries(context ?? {})
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `${key} : ${value}`);

  return [
    `Action métier : ${action.label}`,
    action.description,
    "",
    "Résultats attendus :",
    ...action.outputs.map((output) => `- ${output}`),
    "",
    contextLines.length ? "Contexte du dossier :" : "Contexte du dossier : aucun dossier sélectionné.",
    ...contextLines,
    "",
    "Règles : utiliser uniquement le contexte fourni. Ne jamais inventer de donnée. Rédiger en français québécois naturel et professionnel.",
  ].join("\n");
}
