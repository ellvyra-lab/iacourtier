import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [tasks, appointments] = await Promise.all([
      supabase.from("tasks").select("id,case_id,client_id,title,category,due_at,status").eq("user_id", user.id).eq("status", "pending").order("due_at", { ascending: true, nullsFirst: false }).limit(12),
      supabase.from("appointments").select("id,case_id,client_id,title,appointment_type,starts_at,status").eq("user_id", user.id).gte("starts_at", now.toISOString()).lte("starts_at", inSevenDays.toISOString()).order("starts_at", { ascending: true }).limit(12),
    ]);
    if (tasks.error || appointments.error) return NextResponse.json({ error: tasks.error?.message || appointments.error?.message }, { status: 500 });
    return NextResponse.json({ tasks: tasks.data || [], appointments: appointments.data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger ta journée." }, { status: 500 });
  }
}
