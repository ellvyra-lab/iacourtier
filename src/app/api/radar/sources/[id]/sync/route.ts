import { NextResponse } from "next/server";

import { syncGovernmentSource, type GovernmentSourceRecord } from "@/lib/prospecting/government-source";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: RouteContext) {
  const authError = await requireUser();
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const { data: source, error } = await supabase.from("government_sources").select("*").eq("id", params.id).single();

  if (error || !source) {
    return NextResponse.json({ error: error?.message || "Source introuvable." }, { status: 404 });
  }

  const result = await syncGovernmentSource(supabase, source as GovernmentSourceRecord);
  return NextResponse.json({ result });
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Vous devez être connecté pour synchroniser cette source." }, { status: 401 });
  }

  return null;
}
