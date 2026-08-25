import { NextResponse } from "next/server";

import { normalizeClientValue } from "@/lib/buyer-cases";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  city: string | null;
  postal_code: string | null;
  birth_date: string | null;
  purchase_date: string | null;
  sale_date: string | null;
  mortgage_renewal_date: string | null;
  roles: string[] | null;
  tags: string[] | null;
  client_status: string | null;
  source: string | null;
  language: string | null;
  notes: string | null;
  updated_at: string;
};

type CentralCaseRow = {
  id: string;
  primary_client_id: string | null;
  case_type: string;
  title: string;
  status: string;
  pipeline_stage: string;
  progress: number;
  next_action: string | null;
  next_action_reason: string | null;
  current_stage: string;
  pipeline_progress: number;
  completion_score: number;
  health_score: number;
  priority_score: number;
  updated_at: string;
  property: { id?: string; address?: string; city?: string; property_type?: string } | Array<{ id?: string; address?: string; city?: string; property_type?: string }> | null;
};

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const [clientsResult, relationsResult, casesResult] = await Promise.all([
      supabase.from("clients").select("id,first_name,last_name,email,phone,mailing_address,city,postal_code,birth_date,purchase_date,sale_date,mortgage_renewal_date,roles,tags,client_status,source,language,notes,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("client_case_clients").select("client_id,case_id,role").eq("user_id", user.id),
      supabase.from("client_cases").select("id,primary_client_id,case_type,title,status,pipeline_stage,current_stage,progress,pipeline_progress,completion_score,health_score,priority_score,next_action,next_action_reason,updated_at,property:properties(id,address,city,property_type)").eq("user_id", user.id).order("updated_at", { ascending: false }),
    ]);

    const firstError = clientsResult.error || relationsResult.error || casesResult.error;
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

    const cases = (casesResult.data || []) as CentralCaseRow[];
    const casesById = new Map(cases.map((item) => [item.id, item]));
    const casesByClient = new Map<string, CentralCaseRow[]>();
    const rolesByClient = new Map<string, string[]>();

    for (const relation of relationsResult.data || []) {
      const item = casesById.get(relation.case_id);
      if (!item) continue;
      casesByClient.set(relation.client_id, [...(casesByClient.get(relation.client_id) || []), item]);
      rolesByClient.set(relation.client_id, [...(rolesByClient.get(relation.client_id) || []), relation.role]);
    }

    for (const item of cases) {
      if (!item.primary_client_id) continue;
      const current = casesByClient.get(item.primary_client_id) || [];
      if (!current.some((existing) => existing.id === item.id)) casesByClient.set(item.primary_client_id, [...current, item]);
    }

    const clients = ((clientsResult.data || []) as ClientRow[]).map((client) => {
      const clientCases = casesByClient.get(client.id) || [];
      const roles = Array.from(new Set([
        ...(client.roles || []),
        ...(rolesByClient.get(client.id) || []),
        ...clientCases.flatMap((item) => item.case_type === "buy_sell" ? ["buyer", "seller"] : [item.case_type]),
      ])).filter(Boolean);
      return {
        ...client,
        name: `${client.first_name} ${client.last_name}`.trim() || "Client à identifier",
        roles,
        cases: clientCases,
      };
    });

    const query = normalizeClientValue(new URL(request.url).searchParams.get("q"));
    const filtered = query ? clients.filter((client) => normalizeClientValue([
      client.name,
      client.email,
      client.phone,
      client.mailing_address,
      client.city,
      client.postal_code,
      client.client_status,
      client.source,
      client.notes,
      ...(client.tags || []),
      ...client.cases.flatMap((item) => {
        const property = Array.isArray(item.property) ? item.property[0] : item.property;
        return [item.title, item.case_type, item.status, item.pipeline_stage, item.next_action, property?.address, property?.city, property?.property_type];
      }),
    ].filter(Boolean).join(" ")).includes(query)) : clients;

    return NextResponse.json({ clients: filtered });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les clients et dossiers." }, { status: 500 });
  }
}
