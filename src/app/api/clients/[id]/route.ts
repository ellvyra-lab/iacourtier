import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const { data: client, error: clientError } = await supabase.from("clients").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
    if (!client) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

    const { data: relations, error: relationsError } = await supabase.from("client_case_clients").select("case_id,role").eq("client_id", id).eq("user_id", user.id);
    if (relationsError) return NextResponse.json({ error: relationsError.message }, { status: 500 });
    const caseIds = Array.from(new Set((relations || []).map((item) => item.case_id)));
    const queryIds = caseIds.length ? caseIds : [EMPTY_UUID];

    const [casesResult, propertiesResult, documentsResult, tasksResult, automationsResult, communicationsResult, appointmentsResult, activityResult] = await Promise.all([
      supabase.from("client_cases").select("*,property:properties(id,address,city,postal_code,property_type,lot_number)").eq("user_id", user.id).in("id", queryIds).order("updated_at", { ascending: false }),
      supabase.from("client_properties").select("relationship,case_id,property:properties(id,address,city,postal_code,property_type,lot_number)").eq("user_id", user.id).eq("client_id", id),
      supabase.from("documents").select("*").eq("user_id", user.id).in("case_id", queryIds).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("user_id", user.id).in("case_id", queryIds).order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("automations").select("*").eq("user_id", user.id).in("case_id", queryIds).order("updated_at", { ascending: false }),
      supabase.from("communications").select("*").eq("user_id", user.id).or(`client_id.eq.${id},case_id.in.(${queryIds.join(",")})`).order("occurred_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("user_id", user.id).or(`client_id.eq.${id},case_id.in.(${queryIds.join(",")})`).order("starts_at", { ascending: true }),
      supabase.from("activity_events").select("*").eq("user_id", user.id).or(`client_id.eq.${id},case_id.in.(${queryIds.join(",")})`).order("created_at", { ascending: false }).limit(100),
    ]);

    const error = casesResult.error || propertiesResult.error || documentsResult.error || tasksResult.error || automationsResult.error || communicationsResult.error || appointmentsResult.error || activityResult.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      client,
      cases: casesResult.data || [],
      caseRoles: relations || [],
      properties: propertiesResult.data || [],
      documents: documentsResult.data || [],
      tasks: tasksResult.data || [],
      automations: automationsResult.data || [],
      communications: communicationsResult.data || [],
      appointments: appointmentsResult.data || [],
      activity: activityResult.data || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger la fiche client." }, { status: 500 });
  }
}
