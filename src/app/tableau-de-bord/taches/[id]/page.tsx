import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CoachTaskActions } from "@/components/coach-conversation";

export default async function TaskPage({ params }: { params: { id: string } }) {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/connexion");
  const { data: task, error } = await db.from("tasks").select("id,title,description,due_on,due_at,status,case_id,client_id").eq("id", params.id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Impossible de charger cette tâche.");
  if (!task) notFound();
  return <article className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-slate-200 p-6">
    <p className="text-sm text-slate-500">Tâche</p><h1 className="text-2xl font-semibold">{task.title}</h1>
    <p className="whitespace-pre-wrap">{task.description}</p><p>Échéance : {task.due_at ? new Date(task.due_at).toLocaleString("fr-CA", { timeZone: "America/Toronto" }) : task.due_on || "non précisée"}</p>
    <p>Statut : {task.status === "completed" ? "Terminée" : task.status === "cancelled" ? "Annulée" : "À faire"}</p>
    <CoachTaskActions id={task.id} title={task.title} completed={task.status === "completed"} />
    <div className="flex flex-wrap gap-4">{task.case_id ? <Link className="text-blue-700 underline" href={`/tableau-de-bord/dossiers/${task.case_id}`}>Ouvrir le dossier</Link> : null}{task.client_id ? <Link className="text-blue-700 underline" href={`/tableau-de-bord/clients/${task.client_id}`}>Ouvrir le client</Link> : null}</div>
  </article>;
}
