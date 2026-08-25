import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    const [cases, clients, properties, documents, automations] = await Promise.all([
      supabase.from("client_cases").select("id,title,case_type,pipeline_type,pipeline_stage,current_stage,pipeline_progress,completion_score,health_score,priority_score,next_action,primary_client_id,property_id").eq("user_id", user.id),
      supabase.from("clients").select("id,first_name,last_name").eq("user_id", user.id),
      supabase.from("properties").select("id,address,city").eq("user_id", user.id),
      supabase.from("documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("automations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    ]);
    const error = cases.error || clients.error || properties.error || documents.error || automations.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const paths = (documents.data || []).map((item) => item.storage_path).filter(Boolean);
    const signedByPath = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("seller-listing-files").createSignedUrls(paths, 60 * 60);
      (signed || []).forEach((item, index) => { if (item.signedUrl) signedByPath.set(paths[index], item.signedUrl); });
    }
    const sensitiveDocuments = (documents.data || []).filter((item) => item.is_sensitive && signedByPath.has(item.storage_path));
    if (sensitiveDocuments.length) {
      const { error: logError } = await supabase.from("document_access_logs").insert(sensitiveDocuments.map((item) => ({ user_id: user.id, document_id: item.id, action: "view" })));
      if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });
    }
    return NextResponse.json({
      cases: cases.data || [], clients: clients.data || [], properties: properties.data || [], automations: automations.data || [],
      documents: (documents.data || []).map((item) => ({ ...item, url: signedByPath.get(item.storage_path) || "" })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les ressources CRM." }, { status: 500 });
  }
}

