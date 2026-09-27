import { createSupabaseServerClient } from "@/lib/supabase/server";
import { configurationReady, listAccounts } from "@/lib/server/connections/accounts";
import { centrisProvider } from "@/lib/server/connections/centris";
export const dynamic = "force-dynamic";
export async function GET() {
  const db = await createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Session expirée." }, { status: 401 });
  const configured = { google: configurationReady("google"), microsoft: configurationReady("microsoft") };
  const centris = await centrisProvider(user.id).getConnectionStatus();
  try { return Response.json({ accounts: await listAccounts(user.id), configured, centris }); }
  catch (error) { return Response.json({ accounts: [], configured: {google:false,microsoft:false}, centris, error: error instanceof Error ? error.message : "Connexions indisponibles." }, { status: 503 }); }
}
