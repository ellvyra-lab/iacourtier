import { NextResponse } from "next/server";

import { syncGovernmentSource, type GovernmentSourceRecord } from "@/lib/prospecting/government-source";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const authError = await requireUserOrCronSecret(request);
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const { data: sources, error } = await supabase.from("government_sources").select("*").eq("active", true).order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const source of (sources ?? []) as GovernmentSourceRecord[]) {
    results.push(await syncGovernmentSource(supabase, source));
  }

  return NextResponse.json({
    syncedSources: results.length,
    results,
  });
}

async function requireUserOrCronSecret(request: Request) {
  const cronSecret = process.env.RADAR_SYNC_SECRET;
  const requestSecret = request.headers.get("x-radar-sync-secret");

  if (cronSecret && requestSecret === cronSecret) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Vous devez être connecté pour synchroniser le Radar." }, { status: 401 });
  }

  return null;
}
