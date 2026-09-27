import { createSupabaseServerClient } from "@/lib/supabase/server";
import { connectionStore } from "@/lib/server/connections/accounts";
import { connectedProviders } from "@/lib/server/connections/providers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if(!user)return Response.json({error:"Session expirée."},{status:401});
  try {
    const query = new URL(request.url).searchParams;
    const referenceId = query.get("reference"), attachmentId = query.get("attachment");
    if(!referenceId || !/^[a-f0-9-]{36}$/i.test(referenceId) || !attachmentId || attachmentId.length>2048)throw new Error("Pièce jointe invalide.");
    const {data:ref,error} = await connectionStore().from("connected_references").select("account_id,remote_id").eq("id",referenceId).eq("user_id",user.id).eq("kind","email").maybeSingle();
    if(error || !ref)return Response.json({error:"Courriel inaccessible."},{status:404});
    const p = await connectedProviders(user.id,ref.account_id);
    if(!p.email.readAttachment)throw new Error("Ouvre cette pièce jointe dans ta messagerie.");
    const file = await p.email.readAttachment(ref.remote_id,attachmentId);
    const name = encodeURIComponent(file.name.replace(/[\r\n]/g, "")).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`);
    return new Response(new Uint8Array(file.data).buffer,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename*=UTF-8''${name}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(e) {return Response.json({error:e instanceof Error?e.message:"Lecture impossible."},{status:400});}
}
