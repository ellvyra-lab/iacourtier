import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { getBusinessActions } from "@/lib/business-actions";

export default function BusinessActionsPage() {
  const actions = getBusinessActions();

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <p className="text-sm font-semibold text-electric-500">Missions du jour</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Qu’est-ce qu’on avance maintenant ?</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Choisissez une vraie mission de courtage. IACourtier prépare les bons textes, suivis, questions et documents en arrière-plan, sans vous demander de choisir un outil technique.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.href || `/tableau-de-bord/actions/${action.id}`}
            className="group flex min-h-72 flex-col rounded-2xl border border-subtle bg-surface p-5 transition hover:-translate-y-1 hover:shadow-glow"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-full bg-electric-500/10 px-3 py-1 text-xs font-semibold text-electric-500">{action.context}</span>
              {action.primary ? <span className="rounded-full border border-subtle px-3 py-1 text-xs text-muted">Recommandé</span> : null}
            </div>
            <h2 className="mt-5 text-xl font-semibold">{action.label}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{action.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {action.outputs.slice(0, 4).map((output) => (
                <span key={output} className="rounded-full border border-subtle px-2.5 py-1 text-xs text-muted">
                  {output}
                </span>
              ))}
            </div>
            <div className="mt-auto pt-5">
              <div className="mb-3 space-y-1">
                {(action.serviceLabels ?? []).slice(0, 3).map((service) => (
                  <p key={service} className="flex items-center gap-2 text-xs text-muted">
                    <Sparkles className="h-3.5 w-3.5 text-electric-500" />
                    Préparé en arrière-plan : {service}
                  </p>
                ))}
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-electric-500">
                Commencer cette mission
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
