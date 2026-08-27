import { NextResponse } from "next/server";

import { crmPipelineStages } from "@/lib/crm-operating-system";
import { recalculateUserCases } from "@/lib/server/crm-operating-system";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const evaluations = await recalculateUserCases(supabase, user.id);
    const { data: cases, error } = await supabase
      .from("client_cases")
      .select("*,property:properties(id,address,city,postal_code,property_type)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("priority_score", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const caseIds = (cases || []).map((item) => item.id);
    const [relationsResult, dependenciesResult, conditionsResult] = caseIds.length ? await Promise.all([
      supabase.from("client_case_clients").select("case_id,client_id,role,client:clients(id,first_name,last_name,email,phone)").eq("user_id", user.id).in("case_id", caseIds),
      supabase.from("case_dependencies").select("*").eq("user_id", user.id),
      supabase.from("case_conditions").select("id,case_id,title,status,due_at").eq("user_id", user.id).in("case_id", caseIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    const relatedError = relationsResult.error || dependenciesResult.error || conditionsResult.error;
    if (relatedError) throw relatedError;

    const relations = relationsResult.data || [];
    return NextResponse.json({
      cases: (cases || []).map((item) => ({
        ...item,
        clients: relations.filter((relation) => relation.case_id === item.id).map((relation) => ({ ...relation.client, role: relation.role })),
        dependencies: (dependenciesResult.data || []).filter((dependency) => dependency.predecessor_case_id === item.id || dependency.successor_case_id === item.id),
        conditions: (conditionsResult.data || []).filter((condition) => condition.case_id === item.id),
      })),
      stages: {
        seller: crmPipelineStages("seller"),
        buyer: crmPipelineStages("buyer"),
        post_transaction: crmPipelineStages("post_transaction"),
      },
      evaluations,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger le pipeline." }, { status: 500 });
  }
}

