import { NextResponse } from "next/server";

import type { MarketAnalysisInput } from "@/lib/market-analysis";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mandatId = searchParams.get("mandatId")?.trim();

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Vous devez être connecté pour voir vos analyses." }, { status: 401 });
    }

    let query = supabase
      .from("market_analyses")
      .select("id,user_id,mandat_id,source_type,file_name,extracted_text,subject_property,comparables,objective,style,generated_text,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (mandatId) {
      query = query.eq("mandat_id", mandatId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ analyses: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<MarketAnalysisInput> & {
      generatedText?: string;
      sourceType?: string;
      fileName?: string;
      extractedText?: string;
    };

    if (!body.generatedText?.trim() || !body.mandatId) {
      return NextResponse.json({ error: "Les données de l'analyse sont incomplètes." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Vous devez être connecté pour sauvegarder cette analyse." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("market_analyses")
      .insert({
        user_id: user.id,
        mandat_id: body.mandatId,
        source_type: body.sourceType || "manual",
        file_name: body.fileName || null,
        extracted_text: body.extractedText || null,
        subject_property: body.subjectProperty || null,
        comparables: body.comparables || [],
        objective: body.objective || null,
        style: body.style || null,
        generated_text: body.generatedText,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
