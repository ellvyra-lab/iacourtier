import { NextResponse } from "next/server";

import { analyzeInboxText } from "@/lib/server/ai-inbox";
import { normalizePhone } from "@/lib/crm-phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    const body = await request.json() as { text?: string; sourceType?: string };
    const text = String(body.text || "").trim();
    if (!text) return NextResponse.json({ error: "Ajoute un message à analyser." }, { status: 400 });
    const { analysis, engine } = await analyzeInboxText(text);
    const { data: clients, error: clientError } = await supabase.from("clients").select("id,first_name,last_name,email,phone,roles,tags").eq("user_id", user.id).limit(5000);
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
    const email = analysis.person.email.toLowerCase();
    const phone = normalizePhone(analysis.person.phone);
    const first = fold(analysis.person.firstName);
    const last = fold(analysis.person.lastName);
    const matches = (clients || []).map((client) => {
      const reasons: string[] = [];
      if (email && String(client.email || "").trim().toLowerCase() === email) reasons.push("courriel exact");
      if (phone && normalizePhone(client.phone) === phone) reasons.push("téléphone exact");
      if (first && last && fold(client.first_name) === first && fold(client.last_name) === last) reasons.push("prénom + nom");
      else if (first && !last && fold(client.first_name) === first) reasons.push("prénom seulement — à confirmer");
      return reasons.length ? { ...client, reasons, certainty: reasons.some((value) => value.includes("exact")) ? "certain" : "ambiguous" } : null;
    }).filter(Boolean);
    const certain = matches.filter((item: any) => item.certainty === "certain");
    const status = certain.length === 1 || matches.length === 0 ? "pending" : "needs_confirmation";
    const ambiguity = matches.length > 1 || (matches.length === 1 && (matches[0] as any).certainty === "ambiguous") ? matches : [];
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
    return NextResponse.json({ captureId: capture.id, analysis, engine, potentialDuplicates: matches, suggestedClientId: certain.length === 1 ? (certain[0] as any).id : null, requiresChoice: status === "needs_confirmation" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse impossible." }, { status: 500 });
  }
}

function allowedSource(value?: string) { return ["voice","text","image","document","call","task","note","other"].includes(String(value)) ? value : "text"; }
function fold(value?: string | null) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }

