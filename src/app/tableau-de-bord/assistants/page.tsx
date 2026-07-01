import Link from "next/link";
import { assistantsConfig } from "@/data/assistantsConfig";
import { getFeaturedContextualAiActions } from "@/lib/ai-actions";

export default function DashboardAssistantsIndexPage() {
  const contextualActions = getFeaturedContextualAiActions();

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-electric-500">A) Actions liées à un client / mandat</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Travaillez depuis le contexte du dossier</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              IACourtier recommande les bonnes actions selon le statut du client : prospection, rendez-vous vendeur, mandat signé ou propriété vendue.
            </p>
          </div>
          <Link href="/tableau-de-bord/pipeline" className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background">
            Ouvrir le Pipeline
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          {contextualActions.map((action) => (
            <Link key={action.id} href={action.href || "/tableau-de-bord/pipeline"} className="rounded-xl border border-subtle bg-background/80 p-4 transition hover:-translate-y-0.5 hover:shadow-glow">
              <span className="rounded-full bg-electric-500/10 px-2.5 py-1 text-xs font-semibold text-electric-500">{action.context}</span>
              <p className="mt-4 font-semibold">{action.label}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{action.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {action.outputs.slice(0, 3).map((output) => (
                  <span key={output} className="rounded-full border border-subtle px-2 py-1 text-xs text-muted">
                    {output}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-sm font-semibold text-muted">B) Actions libres sans client</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Assistants autonomes</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {assistantsConfig.map((a) => (
            <Link
              key={a.slug}
              href={`/tableau-de-bord/assistants/${a.slug}`}
              className="group flex flex-col gap-3 rounded-2xl border border-subtle bg-surface-soft p-6 transition-shadow hover:shadow-glow"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500/15 to-cyan-500/15 text-2xl">
                {a.emoji}
              </span>
              <p className="font-semibold">{a.title}</p>
              <p className="text-sm text-muted">{a.result}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
