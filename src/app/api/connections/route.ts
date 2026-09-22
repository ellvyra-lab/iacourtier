import { createSupabaseServerClient } from "@/lib/supabase/server";
import { configurationReady, listAccounts } from "@/lib/server/connections/accounts";
export const dynamic = "force-dynamic";
export async function GET() {
  const db = await createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Session expirée." }, { status: 401 });
  const configured = { google: configurationReady("google"), microsoft: configurationReady("microsoft") };
  try { return Response.json({ accounts: await listAccounts(user.id), configured }); }
  catch (error) { return Response.json({ accounts: [], configured, error: error instanceof Error ? error.message : "Connexions indisponibles." }, { status: 503 }); }
}
