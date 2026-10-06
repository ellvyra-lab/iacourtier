import { createSupabaseServerClient } from "@/lib/supabase/server";
import { changeCrmTask } from "@/lib/server/coach-crm-actions";
import { coachUuid } from "@/lib/server/process-coach-message";
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine invalide." }, { status: 403 });
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Ta session a expiré." }, { status: 401 });
  if (!coachUuid(params.id)) return Response.json({ error: "Tâche invalide." }, { status: 400 });
  try {
    const body = await request.json();
    if (typeof body.title !== "string" || (body.dueOn !== null && typeof body.dueOn !== "string")) return Response.json({ error: "Titre ou date invalide." }, { status: 400 });
    const { data: previous, error } = await db.from("tasks").select("due_on,due_at").eq("id", params.id).eq("user_id", user.id).single();
    if (error || !previous) return Response.json({ error: "Tâche inaccessible." }, { status: 404 });
    const task = await changeCrmTask(db, user.id, { id: params.id, title: body.title, dueOn: body.dueOn, ...(previous.due_on === body.dueOn && previous.due_at ? { dueAt: previous.due_at } : {}) });
    return Response.json({ task });
  } catch { return Response.json({ error: "La tâche n’a pas pu être modifiée. Vérifie le titre et la date." }, { status: 400 }); }
}
