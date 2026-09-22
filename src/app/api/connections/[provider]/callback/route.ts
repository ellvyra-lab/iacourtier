import { createSupabaseServerClient } from "@/lib/supabase/server";
import { finishOAuth, oauthConfig, providerName } from "@/lib/server/connections/accounts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const url = new URL(request.url);
  try {
    const provider = providerName(params.provider), config = oauthConfig(provider);
    const destination = new URL("/tableau-de-bord/parametres/connexions", config.origin);
    try {
      const db = await createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error("Ta session a expiré. Connecte-toi puis recommence la connexion du compte.");
      if (url.searchParams.has("error")) throw new Error("Autorisation refusée ou annulée. Aucun compte connecté.");
      await finishOAuth(user.id,provider,url.searchParams.get("state") || "",url.searchParams.get("code") || "");
      destination.searchParams.set("notice", "Compte connecté. Tu peux demander ton topo au Coach.");
    } catch(error) { destination.searchParams.set("notice", error instanceof Error ? error.message : "Connexion impossible."); }
    return Response.redirect(destination,303);
  } catch { return Response.json({ error: "La configuration OAuth est indisponible." }, { status: 503 }); }
}
