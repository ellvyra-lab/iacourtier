import "server-only";
import type { CoachContext } from "@/lib/coach/conversation";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
// The browser sends a route, never trusted entity data or an owner identifier.
export async function applyCoachPageContext(db: Supabase, userId: string, context: CoachContext, path?: string) {
  if (!path || !/^\/tableau-de-bord(?:\/[a-zA-Z0-9_-]+)*$/.test(path) || path.length > 240) return;
  const previous = context.page_path;
  context.page_path = path;
  const match = path.match(/^\/tableau-de-bord\/(clients|dossiers|proprietes|taches|inscriptions|acheteurs)\/([0-9a-f-]{36})$/i);
  if (!match) return; // General navigation must preserve the conversation and pending draft.
  if (previous !== path) {
    context.current_client_id = null;
    context.current_case_id = null;
    context.current_property_id = null;
    context.current_task_id = null;
    context.current_document_id = null;
    context.current_relationship_client_ids = null;
  }
  const tables: Record<string, string> = { clients: "clients", dossiers: "client_cases", proprietes: "properties", taches: "tasks", inscriptions: "seller_listings", acheteurs: "buyer_cases" };
  const table = tables[match[1].toLowerCase()];
  if (!table) return;
  const specialized = table === "seller_listings" || table === "buyer_cases";
  const { data, error } = await db.from(table).select(specialized ? "id,client_case_id" : "id").eq("id", match[2]).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Le contexte de la page n’a pas pu être vérifié. Réessaie avant de demander une action sur cette fiche.");
  if (!data) return;
  const row = data as unknown as { id: string; client_case_id?: string | null };
  if (specialized && row.client_case_id) {
    const linked = await db.from("client_cases").select("id").eq("id", row.client_case_id).eq("user_id", userId).maybeSingle();
    if (linked.error) throw new Error("Le dossier lié n’a pas pu être vérifié.");
    if (linked.data) context.current_case_id = linked.data.id;
  }
  if (table === "clients") context.current_client_id = row.id;
  if (table === "client_cases") context.current_case_id = row.id;
  if (table === "properties") context.current_property_id = row.id;
  if (table === "tasks") context.current_task_id = row.id;
}
