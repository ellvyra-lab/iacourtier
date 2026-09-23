export const coachMigration = "202609211054_coach_conversations.sql";

export function coachStorageError(error: { code?: string }, operation: string) {
  const code = error.code || "unknown";
  // Log identifiers only: never log SQL data, message text, tokens or credentials.
  console.error("coach_storage_error", { operation, code });
  if (["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(code)) {
    return new Error(`Le schéma Supabase du Coach est incomplet (${code}). Applique le fichier ${coachMigration} au projet Supabase utilisé par cette application, puis recharge la page.`);
  }
  if (code === "42501") return new Error(`Supabase refuse l’accès au Coach (42501). Vérifie les droits et les policies RLS avec le fichier ${coachMigration}.`);
  return new Error(`Supabase n’a pas pu ${operation} (${code}). Réessaie dans quelques instants. Si le problème persiste, consulte les journaux serveur.`);
}
