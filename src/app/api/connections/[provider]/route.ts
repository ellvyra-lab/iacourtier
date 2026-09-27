import { createSupabaseServerClient } from "@/lib/supabase/server";
import { beginOAuth, disconnectAccount, providerName } from "@/lib/server/connections/accounts";
import { listAccounts } from "@/lib/server/connections/accounts";
import { connectedProviders } from "@/lib/server/connections/providers";
import { dateWindow } from "@/lib/connections/dates";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: { provider: string } }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine invalide." }, { status: 403 });
  const db = await createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Session expirée." }, { status: 401 });
  try {
    const provider = providerName(params.provider), body = await request.json();
    if (body.action === "disconnect") return Response.json({ message: await disconnectAccount(user.id,provider) });
    if (body.action === "verify") {
      const account = (await listAccounts(user.id)).find(a=>a.provider===provider);
      if(!account)throw new Error("Connecte d’abord ce compte.");
      const p = await connectedProviders(user.id,account.id), window = dateWindow("aujourd’hui");
      await Promise.all([p.email.listMessages({limit:1}),p.calendar.listEvents(window.start,window.end)]);
      return Response.json({message:"Accès réel aux courriels et à l’agenda vérifié. Aucun message envoyé et aucun événement créé."});
    }
    if (body.action !== "connect") throw new Error("Action inconnue.");
    return Response.json({ url: await beginOAuth(user.id,provider) });
  } catch(error) { return Response.json({ error: error instanceof Error ? error.message : "Connexion impossible." }, { status: 400 }); }
}
