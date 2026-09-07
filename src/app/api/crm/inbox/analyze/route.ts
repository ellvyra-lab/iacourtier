import { NextResponse } from "next/server";

import { normalizePhone } from "@/lib/crm-phone";
import { analyzeInboxText, shouldAutoProcess, type InboxAnalysis } from "@/lib/server/ai-inbox";
import { processQuickCapture } from "@/lib/server/process-quick-capture";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    const body = await request.json() as { text?: string; sourceType?: string };
    const text = String(body.text || "").trim();
    if (!text) return NextResponse.json({ error: "Dis ce qu’il faut retenir avant de terminer." }, { status: 400 });
    let { analysis, engine } = await analyzeInboxText(text);

    let correctionClientId: string | null = null;
    if (analysis.correction && !analysis.person.firstName) {
      const { data: recent } = await supabase.from("inbox_captures").select("client_id,case_id,analysis").eq("user_id", user.id).eq("status", "confirmed").order("confirmed_at", { ascending: false }).limit(1).maybeSingle();
      const previous = recent?.analysis as Partial<InboxAnalysis> | null;
      if (recent?.client_id && previous?.person) {
        correctionClientId = recent.client_id;
        analysis = { ...analysis, person: previous.person as InboxAnalysis["person"], caseType: previous.caseType || analysis.caseType, project: previous.project || analysis.project, confidence: Math.max(analysis.confidence, 0.9) };
      }
    }

    const { data: clients, error: clientError } = await supabase.from("clients").select("id,first_name,last_name,email,phone,roles,tags").eq("user_id", user.id).limit(5000);
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
    const contextClientIds = await clientsForPropertyContext(supabase, user.id, analysis.property.address);
    const matches = findMatches(clients || [], analysis, contextClientIds);
    if (matches.length === 1 && matches[0].reasons.includes("prénom seulement — à confirmer")) {
      matches[0].certainty = "certain";
      matches[0].reasons = ["seule fiche portant ce prénom"];
    }
    if (correctionClientId && !matches.some((item) => item.id === correctionClientId)) {
      const recentClient = (clients || []).find((item) => item.id === correctionClientId);
      if (recentClient) matches.unshift({ ...recentClient, reasons: ["dernière capture corrigée"], certainty: "certain" });
    }
    const certain = matches.filter((item) => item.certainty === "certain");
    const unresolved = certain.length > 1 || matches.some((item) => item.certainty === "ambiguous") && certain.length === 0;
    const ambiguity = unresolved ? matches : [];
    const status = unresolved || !analysis.person.firstName ? "needs_confirmation" : "pending";
    const { data: capture, error: captureError } = await supabase.from("inbox_captures").insert({
      user_id: user.id,
      source_type: allowedSource(body.sourceType),
      raw_text: text.slice(0, 12_000),
      status,
      analysis: { ...analysis, engine },
      ambiguity,
      urgency: analysis.urgency,
    }).select("id").single();
    if (captureError || !capture) return NextResponse.json({ error: captureError?.message || "L’analyse n’a pas pu être enregistrée." }, { status: 500 });

    const suggestedClientId = certain.length === 1 ? certain[0].id : correctionClientId;
    if (shouldAutoProcess(analysis, unresolved)) {
      try {
        const processed = await processQuickCapture(supabase, user.id, { captureId: capture.id, selectedClientId: suggestedClientId });
        return NextResponse.json({ captureId: capture.id, analysis, engine, potentialDuplicates: matches, suggestedClientId, requiresChoice: false, autoProcessed: true, processed });
      } catch (error) {
        await supabase.from("inbox_captures").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", capture.id).eq("user_id", user.id);
        return NextResponse.json({ error: error instanceof Error ? error.message : "La capture a été transcrite, mais le CRM n’a pas pu être mis à jour.", captureId: capture.id }, { status: 500 });
      }
    }
    return NextResponse.json({ captureId: capture.id, analysis, engine, potentialDuplicates: matches, suggestedClientId, requiresChoice: true, autoProcessed: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse impossible." }, { status: 500 });
  }
}

function findMatches(clients: any[], analysis: InboxAnalysis, contextClientIds: Set<string>) {
  const email = analysis.person.email.toLowerCase();
  const phone = normalizePhone(analysis.person.phone);
  const first = fold(analysis.person.firstName);
  const last = fold(analysis.person.lastName);
  const full = `${first} ${last}`.trim();
  return clients.map((client) => {
    const reasons: string[] = [];
    let certainty: "certain" | "ambiguous" = "ambiguous";
    if (email && String(client.email || "").trim().toLowerCase() === email) { reasons.push("courriel exact"); certainty = "certain"; }
    if (phone && normalizePhone(client.phone) === phone) { reasons.push("téléphone exact"); certainty = "certain"; }
    if (first && last && fold(client.first_name) === first && fold(client.last_name) === last) { reasons.push("prénom + nom exacts"); certainty = "certain"; }
    else if (first && fold(client.first_name) === first && contextClientIds.has(client.id)) { reasons.push("prénom + dossier/propriété"); certainty = "certain"; }
    else if (first && !last && fold(client.first_name) === first) reasons.push("prénom seulement — à confirmer");
    else if (full && last && nameSimilarity(full, `${fold(client.first_name)} ${fold(client.last_name)}`) >= 0.84) reasons.push("nom similaire — à confirmer");
    return reasons.length ? { ...client, reasons, certainty } : null;
  }).filter(Boolean) as Array<any & { reasons: string[]; certainty: "certain" | "ambiguous" }>;
}

async function clientsForPropertyContext(supabase: any, userId: string, address: string) {
  if (!address) return new Set<string>();
  const { data: properties } = await supabase.from("properties").select("id,address").eq("user_id", userId).limit(3000);
  const propertyIds = (properties || []).filter((item: any) => addressKey(item.address) === addressKey(address)).map((item: any) => item.id);
  if (!propertyIds.length) return new Set<string>();
  const { data: cases } = await supabase.from("client_cases").select("primary_client_id").eq("user_id", userId).in("property_id", propertyIds);
  return new Set<string>((cases || []).map((item: any) => item.primary_client_id).filter(Boolean));
}

function nameSimilarity(left: string, right: string) { if (left === right) return 1; const a = new Set(bigrams(left)); const b = new Set(bigrams(right)); if (!a.size || !b.size) return 0; let shared = 0; a.forEach((value) => { if (b.has(value)) shared += 1; }); return (2 * shared) / (a.size + b.size); }
function bigrams(value: string) { const compact = value.replace(/\s+/g, " "); return Array.from({ length: Math.max(0, compact.length - 1) }, (_, index) => compact.slice(index, index + 2)); }
function allowedSource(value?: string) { return ["voice","text","image","document","call","task","note","other"].includes(String(value)) ? value : "text"; }
function addressKey(value: string) { return fold(value).replace(/\b(rue|avenue|av|chemin|boulevard|boul)\b/g, "").replace(/[^a-z0-9]/g, ""); }
function fold(value?: string | null) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }

