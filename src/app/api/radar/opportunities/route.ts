import { NextResponse } from "next/server";

import { prospectFromRadarRow } from "@/lib/prospecting/government-source";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureCentralCase, recordCentralActivity } from "@/lib/server/central-crm";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Vous devez être connecté pour voir les opportunités Radar." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 200), 1), 500);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("radar_opportunities")
    .select("*")
    .order("opportunity_score", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ opportunities: (data ?? []).map(prospectFromRadarRow) });
}

type RadarCrmBody = {
  ownerName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  propertyType?: string;
  reason?: string;
  source?: string;
  radarId?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as RadarCrmBody;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vous devez être connecté pour relier ce prospect au CRM." }, { status: 401 });

    const fullName = (body.contactName || body.ownerName || "").trim();
    if (!fullName) return NextResponse.json({ error: "Identifie d’abord le nom du propriétaire avant de créer sa fiche CRM." }, { status: 400 });
    const parts = fullName.split(/\s+/);
    const firstName = parts.shift() || "";
    const lastName = parts.join(" ");
    const normalizedEmail = body.email?.trim().toLowerCase() || "";
    const normalizedPhone = (body.phone || "").replace(/\D/g, "");

    const { data: existingClients, error: clientsError } = await supabase.from("clients").select("id,first_name,last_name,email,phone,roles,tags").eq("user_id", user.id);
    if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 });
    let client = (existingClients || []).find((item) => {
      const email = item.email?.trim().toLowerCase() || "";
      const phone = (item.phone || "").replace(/\D/g, "");
      const name = normalize(`${item.first_name} ${item.last_name}`);
      return Boolean((normalizedEmail && normalizedEmail === email) || (normalizedPhone && normalizedPhone === phone) || name === normalize(fullName));
    });

    let reusedClient = Boolean(client);
    if (!client) {
      const { data, error } = await supabase.from("clients").insert({ user_id: user.id, first_name: firstName, last_name: lastName, email: body.email?.trim() || null, phone: body.phone?.trim() || null, roles: ["prospect"], tags: ["Prospect Radar"], client_status: "prospect", source: body.source || "Radar de prospection", notes: body.reason || null }).select("id,first_name,last_name,email,phone,roles,tags").single();
      if (error || !data) return NextResponse.json({ error: error?.message || "Création du client impossible." }, { status: 500 });
      client = data;
    } else {
      const updates: Record<string, unknown> = { roles: Array.from(new Set([...(client.roles || []), "prospect"])), tags: Array.from(new Set([...(client.tags || []), "Prospect Radar"])), updated_at: new Date().toISOString() };
      if (!client.email && body.email?.trim()) updates.email = body.email.trim();
      if (!client.phone && body.phone?.trim()) updates.phone = body.phone.trim();
      const { error } = await supabase.from("clients").update(updates).eq("id", client.id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let propertyId: string | null = null;
    if (body.address?.trim()) {
      const { data: properties, error: propertyError } = await supabase.from("properties").select("id,address,city").eq("user_id", user.id);
      if (propertyError) return NextResponse.json({ error: propertyError.message }, { status: 500 });
      propertyId = (properties || []).find((item) => normalize(item.address) === normalize(body.address) && normalize(item.city) === normalize(body.city))?.id || null;
      if (!propertyId) {
        const { data, error } = await supabase.from("properties").insert({ user_id: user.id, address: body.address.trim(), city: body.city?.trim() || "À confirmer", postal_code: body.postalCode?.trim() || null, property_type: body.propertyType?.trim() || null }).select("id").single();
        if (error || !data) return NextResponse.json({ error: error?.message || "Création de la propriété impossible." }, { status: 500 });
        propertyId = data.id;
      }
    }

    const existingQuery = supabase.from("client_cases").select("id").eq("user_id", user.id).eq("primary_client_id", client.id).eq("case_type", "prospect").eq("status", "active");
    const { data: existingCase } = propertyId ? await existingQuery.eq("property_id", propertyId).limit(1).maybeSingle() : await existingQuery.is("property_id", null).limit(1).maybeSingle();
    const caseId = await ensureCentralCase(supabase, { userId: user.id, primaryClientId: client.id, propertyId, participantIds: [client.id], caseType: "prospect", title: propertyId ? `Prospection — ${body.address}` : `Prospection — ${fullName}`, status: "active", pipelineStage: "new_contact", nextAction: "Contacter et qualifier le prospect", source: body.source || "radar", centralCaseId: existingCase?.id || null });

    const { error: taskError } = await supabase.from("tasks").upsert({ user_id: user.id, client_id: client.id, case_id: caseId, category: "prospection", title: "Contacter et qualifier le prospect", status: "pending", validation_required: true }, { onConflict: "case_id,title", ignoreDuplicates: true });
    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    await recordCentralActivity(supabase, { userId: user.id, clientId: client.id, caseId, eventType: existingCase ? "radar_relinked" : "radar_linked", title: existingCase ? "Prospect Radar relié au dossier existant" : "Prospect Radar ajouté au CRM", details: body.reason || null });

    return NextResponse.json({ ok: true, clientId: client.id, caseId, reusedClient, reusedCase: Boolean(existingCase), primaryHref: `/tableau-de-bord/dossiers/${caseId}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de relier le prospect au CRM." }, { status: 500 });
  }
}

function normalize(value?: string | null) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
