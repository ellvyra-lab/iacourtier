import { createSupabaseServerClient } from "@/lib/supabase/server";
import { finishOAuth, oauthConfig, providerName } from "@/lib/server/connections/accounts";
import { coachOAuthRequest, claimCoachOAuthRequest, completeCoachOAuth, discardOAuthState, failCoachOAuth } from "@/lib/server/connections/coach-connections";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { provider: string } }) {
  const url = new URL(request.url);
  try {
    const provider = providerName(params.provider), config = oauthConfig(provider);
    const destination = new URL("/tableau-de-bord/reglages/connexions", config.origin);
    let coachRequest: Awaited<ReturnType<typeof coachOAuthRequest>> = null;
    let owner: string | undefined;
    let storedResult=false;
    try {
      const db = await createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error("Ta session a expiré. Connecte-toi puis recommence la connexion du compte.");
      owner=user.id;
      const state=url.searchParams.get("state") || "";
      coachRequest=await coachOAuthRequest(user.id,provider,state);
      if(coachRequest) {
        destination.pathname="/tableau-de-bord/coach";
        destination.searchParams.set("conversation",coachRequest.conversation_id);
        destination.searchParams.set("connection",coachRequest.id);
        if(coachRequest.status !== "pending")throw new Error("Cette connexion n’est plus en attente. Prépare une nouvelle demande dans le Coach.");
      }
      if (url.searchParams.has("error")) {await discardOAuthState(user.id,provider,state);throw new Error("Autorisation refusée ou annulée. Aucun accès confirmé.");}
      if(coachRequest)await claimCoachOAuthRequest(user.id,coachRequest);
      const accountId=await finishOAuth(user.id,provider,state,url.searchParams.get("code") || "");
      if(coachRequest){await completeCoachOAuth(user.id,coachRequest,accountId);storedResult=true;}
      destination.searchParams.set("notice", "Compte connecté. Tu peux demander ton topo au Coach.");
    } catch(error) {
      const message=error instanceof Error ? error.message : "Connexion impossible.";
      if(owner && coachRequest) {
        try {await failCoachOAuth(owner,coachRequest,message,url.searchParams.get("error")==="access_denied");storedResult=true;}
        catch {destination.searchParams.set("notice","Le résultat n’a pas pu être enregistré. Aucune connexion confirmée : vérifie Réglages → Connexions.");}
      } else destination.searchParams.set("notice",message);
    }
    if(coachRequest && storedResult)destination.searchParams.delete("notice");
    return Response.redirect(destination,303);
  } catch { return Response.json({ error: "La configuration OAuth est indisponible." }, { status: 503 }); }
}
