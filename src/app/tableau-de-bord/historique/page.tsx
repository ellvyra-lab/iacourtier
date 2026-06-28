import Link from "next/link";
import { Sparkles, AlertTriangle, Inbox } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardHistoriquePage() {
  const supabase = await createSupabaseServerClient();

  let userId: string | null = null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    userId = userData.user?.id ?? null;
  } catch (err) {
    console.error("[historique] auth check failed:", err);
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
        <AlertTriangle size={18} />
        Le service n&apos;est pas encore configuré. Contactez l&apos;administrateur du site.
      </div>
    );
  }

  if (!userId) {
    return (
      <p className="text-sm text-muted">
        Connectez-vous pour voir votre historique.
      </p>
    );
  }

  const { data: generations, error } = await supabase
    .from("generations")
    .select("id, assistant_slug, assistant_title, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
        <AlertTriangle size={18} />
        Impossible de charger l&apos;historique pour le moment.
      </div>
    );
  }

  if (!generations || generations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-subtle p-12 text-center">
        <Inbox size={22} className="text-muted" />
        <p className="text-sm text-muted">
          Vous n&apos;avez encore rien généré. Essayez un assistant pour voir
          votre historique apparaître ici.
        </p>
        <Link href="/tableau-de-bord/assistants" className="text-sm font-medium text-electric-500 hover:underline">
          Voir les assistants
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {generations.map((item) => (
        <Link
          key={item.id}
          href={`/tableau-de-bord/assistants/${item.assistant_slug}`}
          className="flex items-center gap-4 rounded-2xl border border-subtle bg-surface-soft p-4 transition-colors hover:border-electric-500/40"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              item.status === "failed"
                ? "bg-red-500/10 text-red-500"
                : "bg-electric-500/10 text-electric-500"
            }`}
          >
            {item.status === "failed" ? (
              <AlertTriangle size={16} />
            ) : (
              <Sparkles size={16} />
            )}
          </span>
          <div className="flex-1">
            <p className="text-sm">
              {item.status === "failed" ? "Échec — " : ""}
              {item.assistant_title}
            </p>
            <p className="text-xs text-muted">
              {new Date(item.created_at).toLocaleString("fr-CA", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
