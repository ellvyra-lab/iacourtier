import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addRelatedParticipant, getClientRelationships, linkClients } from "@/lib/server/client-relationships";
import { relationshipTypes, type RelationshipType } from "@/lib/client-relationships";
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 try{const {id}=await params;if(!uuid(id))return Response.json({error:"Contact invalide."},{status:400});const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)return Response.json({error:"Session expirée."},{status:401});return Response.json({relationships:await getClientRelationships(db,user.id,id)});}catch(e){return Response.json({error:e instanceof Error?e.message:"Relations indisponibles."},{status:400});}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Origine invalide."},{status:403});
 try{const {id}=await params;const body=await request.json();if(!uuid(id)||!uuid(body.relatedClientId))throw new Error("Contacts invalides.");const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)return Response.json({error:"Session expirée."},{status:401});
 if(body.action==="add_to_case"){if(!uuid(body.caseId))throw new Error("Dossier invalide.");return Response.json(await addRelatedParticipant(db,user.id,id,body.relatedClientId,body.caseId));}
 if(!relationshipTypes.includes(body.type))throw new Error("Type de relation invalide.");return Response.json({relationship:await linkClients(db,user.id,id,body.relatedClientId,body.type as RelationshipType)});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Relation non enregistrée."},{status:400});}
}
