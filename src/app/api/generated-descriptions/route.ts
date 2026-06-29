import { NextResponse } from "next/server";

import type { PropertyDescriptionForm } from "@/lib/property-description";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const order = searchParams.get("order") === "oldest" ? "oldest" : "newest";
    const search = searchParams.get("search")?.trim();
    const mandatId = searchParams.get("mandatId")?.trim();

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Vous devez être connecté pour voir vos générations." }, { status: 401 });
    }

    let query = supabase
      .from("generated_descriptions")
      .select("id,user_id,mandat_id,property_type,city,price,generated_text,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: order === "oldest" });

    if (mandatId) {
      query = query.eq("mandat_id", mandatId);
    }

    if (search) {
      query = query.or(`city.ilike.%${search}%,property_type.ilike.%${search}%,generated_text.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ descriptions: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { form?: PropertyDescriptionForm; generatedText?: string; mandatId?: string };
    if (!body.form?.propertyType || !body.form.city?.trim() || !body.generatedText?.trim()) {
      return NextResponse.json({ error: "La description, le type de propriété et la ville sont requis." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Vous devez être connecté pour sauvegarder cette génération." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("generated_descriptions")
      .insert({
        user_id: user.id,
        mandat_id: body.mandatId || null,
        property_type: body.form.propertyType,
        city: body.form.city,
        price: body.form.price?.trim() || null,
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
