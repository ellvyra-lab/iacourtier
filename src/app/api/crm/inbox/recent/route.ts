import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    const { data, error } = await supabase.from("inbox_captures").select("id,raw_text,status,source_type,analysis,client_id,case_id,captured_at,confirmed_at").eq("user_id", user.id).order("captured_at", { ascending: false }).limit(8);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ captures: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les captures récentes." }, { status: 500 });
  }
}

