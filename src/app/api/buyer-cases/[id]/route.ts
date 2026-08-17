import { NextResponse } from "next/server";

import { buyerMissingFields, buyerProgress } from "@/lib/buyer-cases";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    const { data: buyerCase, error } = await supabase
      .from("buyer_cases")
      .select("*,contact:seller_contacts(id,first_name,last_name,email,phone,mailing_address,roles)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    if (!buyerCase) return NextResponse.json({ error: "Dossier acheteur introuvable." }, { status: 404 });

    const [documents, tasks, automations, activity] = await Promise.all([
      supabase.from("buyer_case_documents").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at"),
      supabase.from("buyer_case_tasks").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at"),
      supabase.from("buyer_case_automations").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at"),
      supabase.from("buyer_case_activity").select("*").eq("case_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    const queryError = documents.error || tasks.error || automations.error || activity.error;
    if (queryError) return NextResponse.json({ error: databaseMessage(queryError.message) }, { status: 500 });

    const row = buyerCase as Record<string, unknown>;
    const missingFields = buyerMissingFields(row);
    const completedTasks = (tasks.data || []).filter((task) => task.status === "completed").length;
    const totalTasks = (tasks.data || []).length;
    const nextTask = (tasks.data || []).find((task) => task.status !== "completed");

    return NextResponse.json({
      case: buyerCase,
      documents: documents.data || [],
      tasks: tasks.data || [],
      automations: automations.data || [],
      activity: activity.data || [],
      progress: Math.round(buyerProgress(row) * 0.8 + (totalTasks ? completedTasks / totalTasks : 0) * 20),
      missingFields,
      nextAction: nextTask?.title || (missingFields[0] ? `Compléter : ${missingFields[0]}` : "Préparer le guide acheteur"),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger le dossier acheteur." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    if (body.action === "task") {
      const { error } = await supabase.from("buyer_case_tasks").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.taskId).eq("case_id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    } else if (body.action === "automation") {
      const { error } = await supabase.from("buyer_case_automations").update({ status: body.status, external_delivery_enabled: false, updated_at: new Date().toISOString() }).eq("id", body.automationId).eq("case_id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    } else if (body.action === "criteria") {
      const allowed = ["budget", "preapproval_status", "sectors", "property_type", "bedrooms", "important_needs", "timeline", "property_to_sell", "status"];
      const updates = Object.fromEntries(Object.entries(body.values as Record<string, unknown> || {}).filter(([key]) => allowed.includes(key)));
      const { error } = await supabase.from("buyer_cases").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mise à jour impossible." }, { status: 500 });
  }
}

function expiredSession() {
  return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
}

function databaseMessage(message: string) {
  return /buyer_|schema cache|does not exist/i.test(message) ? "La migration Supabase des parcours guidés n’est pas encore appliquée." : message;
}
