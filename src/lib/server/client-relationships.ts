import { canonicalRelationship, relationshipViews, type RelationshipType, type RelationshipRow, type RelatedContact } from "@/lib/client-relationships";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
type DB=Awaited<ReturnType<typeof createSupabaseServerClient>>;
export async function allRelationships(db:DB,userId:string):Promise<RelationshipRow[]> {
 const rows:RelationshipRow[]=[];
 for(let offset=0;;offset+=500){const {data,error}=await db.from("client_relationships").select("id,client_id,related_client_id,relationship_type,notes").eq("user_id",userId).order("id").range(offset,offset+499);if(error)throw new Error("Les relations ne sont pas disponibles. Vérifie la migration client_relationships.");rows.push(...(data||[]));if(!data||data.length<500)return rows;}
}
export async function ownedContacts(db:DB,userId:string,ids:string[]):Promise<RelatedContact[]> {
 const unique=[...new Set(ids)];if(!unique.length)return [];
 const {data,error}=await db.from("clients").select("id,first_name,last_name,email,mailing_address").eq("user_id",userId).in("id",unique);
 if(error)throw error;if(data?.length!==unique.length)throw new Error("Un des contacts est introuvable ou inaccessible.");return data;
}
export async function getClientRelationships(db:DB,userId:string,clientId:string) {
 await ownedContacts(db,userId,[clientId]);
 const rows=(await allRelationships(db,userId)).filter(r=>r.client_id===clientId||r.related_client_id===clientId);
 const contacts=await ownedContacts(db,userId,rows.flatMap(r=>[r.client_id,r.related_client_id]));
 return relationshipViews(clientId,rows,contacts);
}
export async function linkClients(db:DB,userId:string,first:string,second:string,type:RelationshipType) {
 const relation=canonicalRelationship(first,second,type);await ownedContacts(db,userId,[first,second]);
 const {data,error}=await db.from("client_relationships").insert({user_id:userId,...relation}).select("*").single();
 if(!error)return data as RelationshipRow;
 if(error.code!=="23505")throw error;
 const existing=(await allRelationships(db,userId)).find(r=>r.relationship_type===relation.relationship_type && ((r.client_id===first&&r.related_client_id===second)||(r.client_id===second&&r.related_client_id===first)));
 if(!existing)throw error;
 if(type==="parent"||type==="child")if(existing.client_id!==relation.client_id)throw new Error("Une relation parent/enfant inverse existe déjà. Vérifie les fiches.");
 return existing;
}
export async function addRelatedParticipant(db:DB,userId:string,sourceId:string,relatedId:string,caseId:string) {
 await ownedContacts(db,userId,[sourceId,relatedId]);
 const related=await getClientRelationships(db,userId,sourceId);if(!related.some(r=>r.contact.id===relatedId))throw new Error("Ces contacts ne sont pas reliés.");
 const {data:clientCase,error}=await db.from("client_cases").select("id,primary_client_id,case_type").eq("id",caseId).eq("user_id",userId).maybeSingle();
 if(error)throw error;if(!clientCase)throw new Error("Dossier inaccessible.");
 const {data:participants,error:readError}=await db.from("client_case_clients").select("client_id").eq("user_id",userId).eq("case_id",caseId);
 if(readError)throw readError;
 if(clientCase.primary_client_id!==sourceId&&!participants?.some(r=>r.client_id===sourceId))throw new Error("Le contact de départ ne participe pas à ce dossier.");
 if(clientCase.primary_client_id===relatedId||participants?.some(r=>r.client_id===relatedId))return {id:caseId,added:false};
 const {error:writeError}=await db.from("client_case_clients").upsert({user_id:userId,case_id:caseId,client_id:relatedId,role:clientCase.case_type==="seller"?"seller":clientCase.case_type==="buyer"?"buyer":"client"},{onConflict:"case_id,client_id,role",ignoreDuplicates:true});
 if(writeError)throw writeError;return {id:caseId,added:true};
}
