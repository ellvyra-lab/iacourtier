import { NextResponse } from "next/server";

import { recalculateCaseOperatingState } from "@/lib/server/crm-operating-system";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FIELDS = { address: "address", city: "city", postalCode: "postal_code", propertyType: "property_type", lotNumber: "lot_number" } as const;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expired();
    const { data: property, error } = await supabase.from("properties").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!property) return NextResponse.json({ error: "Propriété introuvable." }, { status: 404 });
    const [relations, cases, documents] = await Promise.all([
      supabase.from("client_properties").select("relationship,case_id,client:clients(id,first_name,last_name,email,phone)").eq("property_id", id).eq("user_id", user.id),
      supabase.from("client_cases").select("id,title,case_type,status,current_stage,pipeline_stage").eq("property_id", id).eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("documents").select("id,name,category,analysis_status,case_id,created_at").eq("property_id", id).eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const queryError = relations.error || cases.error || documents.error;
    if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
    return NextResponse.json({ property, relations: relations.data || [], cases: cases.data || [], documents: documents.data || [] });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Chargement impossible." }, { status: 500 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { values?: Record<string, unknown> };
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expired();
    const updates: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(FIELDS)) if (key in (body.values || {})) updates[column] = clean(body.values?.[key], key === "address" ? 500 : 180);
    if (!Object.keys(updates).length) return NextResponse.json({ error: "Aucune information à enregistrer." }, { status: 400 });
    const now = new Date().toISOString();
    const { data: property, error } = await supabase.from("properties").update({ ...updates, updated_at: now }).eq("id", id).eq("user_id", user.id).select("*").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!property) return NextResponse.json({ error: "Propriété introuvable." }, { status: 404 });
    const { data: cases, error: casesError } = await supabase.from("client_cases").select("id,primary_client_id").eq("property_id", id).eq("user_id", user.id);
    if (casesError) return NextResponse.json({ error: casesError.message }, { status: 500 });
    for (const item of cases || []) {
      const { error: activityError } = await supabase.from("activity_events").insert({ user_id: user.id, client_id: item.primary_client_id, case_id: item.id, event_type: "property_updated", title: "Propriété mise à jour", details: property.address || "Adresse à confirmer" });
      if (activityError) return NextResponse.json({ error: activityError.message }, { status: 500 });
      await recalculateCaseOperatingState(supabase, user.id, item.id);
    }
    return NextResponse.json({ ok: true, property });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status: 500 }); }
}

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) || null : null; }
function expired() { return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 }); }
