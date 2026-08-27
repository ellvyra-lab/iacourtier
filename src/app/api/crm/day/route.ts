import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recalculateUserCases } from "@/lib/server/crm-operating-system";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    await recalculateUserCases(supabase, user.id);
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [tasks, appointments, cases] = await Promise.all([
      supabase.from("tasks").select("id,case_id,client_id,title,category,due_at,status").eq("user_id", user.id).eq("status", "pending").order("due_at", { ascending: true, nullsFirst: false }).limit(12),
      supabase.from("appointments").select("id,case_id,client_id,title,appointment_type,starts_at,status").eq("user_id", user.id).gte("starts_at", now.toISOString()).lte("starts_at", inSevenDays.toISOString()).order("starts_at", { ascending: true }).limit(12),
      supabase.from("client_cases").select("id,title,case_type,current_stage,next_action,next_best_action,next_action_reason,next_action_due_at,priority_score,priority_level,health_score,completion_score,alerts,missing_items,suggested_stage,suggested_stage_reason").eq("user_id", user.id).eq("status", "active").not("next_action", "is", null).order("priority_score", { ascending: false }).limit(12),
    ]);
    if (tasks.error || appointments.error || cases.error) return NextResponse.json({ error: tasks.error?.message || appointments.error?.message || cases.error?.message }, { status: 500 });
    return NextResponse.json({ tasks: tasks.data || [], appointments: appointments.data || [], nextActions: cases.data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger ta journée." }, { status: 500 });
  }
}

