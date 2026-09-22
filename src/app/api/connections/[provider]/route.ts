import { createSupabaseServerClient } from "@/lib/supabase/server";
import { beginOAuth, disconnectAccount, providerName } from "@/lib/server/connections/accounts";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: { provider: string } }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine invalide." }, { status: 403 });
  const db = await createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Session expirée." }, { status: 401 });
  try {
    const provider = providerName(params.provider), body = await request.json();
    if (body.action === "disconnect") return Response.json({ message: await disconnectAccount(user.id,provider) });
    if (body.action !== "connect") throw new Error("Action inconnue.");
    return Response.json({ url: await beginOAuth(user.id,provider) });
  } catch(error) { return Response.json({ error: error instanceof Error ? error.message : "Connexion impossible." }, { status: 400 }); }
}
