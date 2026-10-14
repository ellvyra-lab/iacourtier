import { createSupabaseServerClient } from "@/lib/supabase/server";
import { beginOAuth, disconnectAccount, providerName, setDefaultAccount } from "@/lib/server/connections/accounts";
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
    const account = body.accountId ? (await listAccounts(user.id)).find(a => a.id === body.accountId && a.provider === provider) : undefined;
    if (body.accountId && !account) throw new Error("Compte inaccessible.");
    if (body.action === "default") {
      if (!account || !["email","calendar","contacts"].includes(body.service)) throw new Error("Compte ou service invalide.");
      await setDefaultAccount(user.id,account.id,body.service);
      return Response.json({message:"Compte par défaut enregistré."});
    }
    if (body.action === "disconnect") {
      if (!account) throw new Error("Sélectionne le compte à déconnecter.");
      return Response.json({ message: await disconnectAccount(user.id,provider,account.id) });
    }
    if (body.action === "verify") {
      if(!account)throw new Error("Connecte d’abord ce compte.");
      const p = await connectedProviders(user.id,account.id), window = dateWindow("aujourd’hui");
      await Promise.all([...(account.services?.includes("email") ? [p.email.listMessages({limit:1})] : []),...(account.services?.includes("calendar") ? [p.calendar.listEvents(window.start,window.end)] : []),...(account.services?.includes("contacts") ? [p.searchContacts("",1)] : [])]);
      return Response.json({message:`Accès réel vérifié pour ${account.email} : ${account.services?.join(", ")}. Aucun message envoyé et aucun événement créé.`});
    }
    if (body.action !== "connect") throw new Error("Action inconnue.");
    return Response.json({ url: await beginOAuth(user.id,provider,body.services || account?.services || ["email","calendar"],account?.id) });
  } catch(error) { return Response.json({ error: error instanceof Error ? error.message : "Connexion impossible." }, { status: 400 }); }
}
