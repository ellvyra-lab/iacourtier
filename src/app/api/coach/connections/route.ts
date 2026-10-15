import { createSupabaseServerClient } from "@/lib/supabase/server";
import { connectionRequestAction } from "@/lib/server/connections/coach-connections";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  if(request.headers.get("origin") !== new URL(request.url).origin)return Response.json({error:"Origine invalide."},{status:403});
  const db=await createSupabaseServerClient(), {data:{user}}=await db.auth.getUser();
  if(!user)return Response.json({error:"Session expirée."},{status:401});
  try {const body=await request.json();return Response.json(await connectionRequestAction(user.id,body.id,body.conversationId,body.action));}
  catch(error) {return Response.json({error:error instanceof Error ? error.message : "Connexion non confirmée."},{status:400});}
}
