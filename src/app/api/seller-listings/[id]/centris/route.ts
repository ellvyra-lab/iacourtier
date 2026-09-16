import { NextResponse } from "next/server";

import { CENTRIS_DIRECT_TRANSMISSION_MESSAGE } from "@/lib/centris/connector";
import { prepareCentrisListing } from "@/lib/centris/preparation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
    return NextResponse.json(await prepareCentrisListing(supabase, user.id, id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Préparation Centris impossible." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { action?: string };
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
    const preparation = await prepareCentrisListing(supabase, user.id, id);
    if (body.action === "transmit") return NextResponse.json({ error: CENTRIS_DIRECT_TRANSMISSION_MESSAGE }, { status: 409 });
    if (body.action !== "validate") return NextResponse.json({ error: "Action Centris inconnue." }, { status: 400 });
    if (!preparation.canValidate) return NextResponse.json({ error: "Complétez les champs obligatoires et les éléments à confirmer avant de valider." }, { status: 409 });
    const { error } = await supabase.from("seller_listing_activity").insert({
      user_id: user.id, listing_id: id, event_type: "centris_preparation_validated",
      title: "Préparation Centris validée",
      details: "Les données ont été validées pour copie ou export. Aucune transmission externe n’a été effectuée.",
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, preparation, message: "Préparation validée. Aucune donnée n’a été transmise à Centris." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validation Centris impossible." }, { status: 500 });
  }
}
