"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import type { GeneratedDescription } from "@/lib/mandats";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LocalGeneratedDescription = Pick<GeneratedDescription, "id" | "mandat_id" | "property_type" | "city" | "price" | "generated_text" | "created_at">;

export function MandateGeneratedContent({ mandatId }: { mandatId: string }) {
  const [descriptions, setDescriptions] = useState<LocalGeneratedDescription[]>([]);
  const [status, setStatus] = useState("Chargement des contenus générés...");

  useEffect(() => {
    let isMounted = true;

    async function loadGeneratedContent() {
      const localItems = JSON.parse(window.localStorage.getItem(`iacourtier-generated-descriptions-${mandatId}`) || "[]") as LocalGeneratedDescription[];

      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (token) {
          const response = await fetch(`/api/generated-descriptions?mandatId=${mandatId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const payload = (await response.json()) as { descriptions?: GeneratedDescription[] };
          if (response.ok && isMounted) {
            setDescriptions([...(payload.descriptions ?? []), ...localItems]);
            setStatus("");
            return;
          }
        }
      } catch {
        // Supabase non configuré: on garde le repli local.
      }

      if (isMounted) {
        setDescriptions(localItems);
        setStatus(localItems.length ? "" : "Aucun contenu généré pour ce mandat pour l'instant.");
      }
    }

    loadGeneratedContent();
    return () => {
      isMounted = false;
    };
  }, [mandatId]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Contenus générés</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Descriptions et contenus associés à ce mandat.</p>
        </div>
      </div>

      {status ? <p className="mt-5 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">{status}</p> : null}

      {descriptions.length ? (
        <div className="mt-5 grid gap-4">
          {descriptions.map((description) => (
            <article key={description.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold">Description de propriété</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(description.created_at))}
                </p>
              </div>
              <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{description.generated_text}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
