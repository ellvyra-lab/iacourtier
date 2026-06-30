import { NextResponse } from "next/server";

import { prospectFromRadarRow } from "@/lib/prospecting/government-source";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
