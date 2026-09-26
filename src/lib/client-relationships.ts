export const relationshipTypes = ["spouse", "partner", "ex_spouse", "family", "parent", "child", "business_partner", "co_owner", "other"] as const;
export type RelationshipType = typeof relationshipTypes[number];
export const relationshipLabels: Record<RelationshipType, string> = { spouse:"Conjoint(e)", partner:"Partenaire", ex_spouse:"Ex-conjoint(e)", family:"Famille", parent:"Parent", child:"Enfant", business_partner:"Partenaire d’affaires", co_owner:"Copropriétaire", other:"Autre lien" };
export type RelationshipRow = { id:string; client_id:string; related_client_id:string; relationship_type:RelationshipType; notes?:string | null };
export type RelatedContact = { id:string; first_name:string; last_name:string; email?:string | null; mailing_address?:string | null };
export type RelationshipView = { id:string; type:RelationshipType; label:string; contact:RelatedContact };
export function canonicalRelationship(clientId:string, relatedId:string, type:RelationshipType) {
  if (!relationshipTypes.includes(type) || clientId===relatedId) throw new Error("Choisis deux contacts distincts et un type de relation valide.");
  if (type==="child") return { client_id:relatedId, related_client_id:clientId, relationship_type:"parent" as RelationshipType };
  if (type!=="parent" && clientId>relatedId) return { client_id:relatedId, related_client_id:clientId, relationship_type:type };
  return { client_id:clientId, related_client_id:relatedId, relationship_type:type };
}
// type describes the source person's role; the display describes the other person.
export function relationshipViews(clientId:string, rows:RelationshipRow[], contacts:RelatedContact[]):RelationshipView[] {
  const byId=new Map(contacts.map(c=>[c.id,c]));
  return rows.filter(r=>r.client_id===clientId || r.related_client_id===clientId).flatMap(r=>{
    const contact=byId.get(r.client_id===clientId?r.related_client_id:r.client_id); if(!contact)return [];
    const type=r.relationship_type==="parent" ? (r.client_id===clientId?"child":"parent") : r.relationship_type==="child" ? (r.client_id===clientId?"parent":"child") : r.relationship_type;
    return [{id:r.id,type,label:relationshipLabels[type] || "Autre lien",contact}];
  });
}
export function isCombinedPersonName(name:string) { return /\s(?:et|and|&)\s|\s\/\s/i.test(name.trim()); }
export function distinctNamedPeople(a:{firstName?:string|null;lastName?:string|null},b:{firstName?:string|null;lastName?:string|null}) {
 const fold=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
 return Boolean(a.firstName&&a.lastName&&b.firstName&&b.lastName&&fold(`${a.firstName}${a.lastName}`)!==fold(`${b.firstName}${b.lastName}`));
}
export type ImportedRelationship = {person1:string;person2:string;type:RelationshipType;confidence:number;sourceName:string;evidence:string};
export type RelationshipSuggestion = ImportedRelationship & {clientId:string;relatedClientId:string};
