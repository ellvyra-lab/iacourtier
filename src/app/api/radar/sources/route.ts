import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SourcePayload = {
  name?: string;
  province?: string;
  city?: string;
  organization?: string;
  url?: string;
  sourceType?: string;
  updateFrequency?: string;
  active?: boolean;
};

export async function GET() {
  const authError = await requireUser();
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("government_sources").select("*").order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sources: data ?? [] });
}

export async function POST(request: Request) {
  const authError = await requireUser();
  if (authError) return authError;

  try {
    const body = (await request.json()) as SourcePayload;
    const url = body.url?.trim();
    const name = body.name?.trim();

    if (!name || !url) {
      return NextResponse.json({ error: "Le nom et l'URL de la source sont requis." }, { status: 400 });
    }

    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Utilisez une URL publique HTTP ou HTTPS." }, { status: 400 });
    }

    const sourceType = normalizeSourceType(body.sourceType);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("government_sources")
      .insert({
        name,
        province: body.province?.trim() || "Québec",
        city: body.city?.trim() || null,
        organization: body.organization?.trim() || null,
        url,
        source_type: sourceType,
        update_frequency: body.updateFrequency?.trim() || "nightly",
        active: body.active ?? true,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ source: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La source n'a pas pu être créée.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Vous devez être connecté pour gérer les sources Radar." }, { status: 401 });
  }

  return null;
}

function normalizeSourceType(value?: string) {
  const normalized = value?.toUpperCase();
  if (normalized === "XML" || normalized === "API") return normalized;
  return "CSV";
}
