"use client";
import {useState} from "react";
import {useDashboardAuth} from "@/components/auth/DashboardAuthProvider";
import {relationshipLabels,type RelationshipSuggestion} from "@/lib/client-relationships";
export function ImportedRelationshipSuggestions({suggestions}:{suggestions:RelationshipSuggestion[]}) {
 const {authenticatedFetch}=useDashboardAuth();const [done,setDone]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function confirm(r:RelationshipSuggestion,key:string){setBusy(true);setError("");try{const response=await authenticatedFetch(`/api/clients/${r.clientId}/relationships`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({relatedClientId:r.relatedClientId,type:r.type})});const b=await response.json();if(!response.ok)throw new Error(b.error);setDone(v=>[...v,key]);window.dispatchEvent(new Event("crm-updated"));}catch(e){setError(e instanceof Error?e.message:"Relation non enregistrée.");}finally{setBusy(false);}}
 if(!suggestions.length)return null;
 return <section className="mt-4 space-y-3 rounded-xl border bg-white p-4 dark:bg-slate-950"><h2 className="font-semibold">Relations proposées par le document</h2><p className="text-sm">Les contacts restent distincts. Confirme uniquement les liens établis par la source.</p>{error?<p role="alert" className="text-red-700">{error}</p>:null}{suggestions.map(r=>{const key=`${r.clientId}:${r.relatedClientId}:${r.type}`;return <div key={key} className="rounded-lg border p-3 text-sm"><p>{r.person1} ↔ {r.person2} · {relationshipLabels[r.type]}</p><p className="mt-1 text-slate-500">{r.sourceName} · confiance {Math.round(r.confidence*100)} % · {r.evidence}</p><button type="button" disabled={busy||done.includes(key)} onClick={()=>void confirm(r,key)} className="mt-2 min-h-11 rounded-lg border px-3 disabled:opacity-50">{done.includes(key)?"Relation enregistrée":"Confirmer la relation"}</button></div>;})}</section>;
}
