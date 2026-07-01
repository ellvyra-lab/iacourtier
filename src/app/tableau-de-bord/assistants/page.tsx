import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { assistantsConfig } from "@/data/assistantsConfig";

export default function InternalAiServicesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <p className="text-sm font-semibold text-electric-500">Services IA internes</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Les assistants ne sont plus le point d&apos;entrée.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          IACourtier est organisé autour des actions métier du courtier. Ces services restent disponibles pour maintenance et tests, mais l&apos;expérience normale commence par une action.
        </p>
        <Link href="/tableau-de-bord/actions" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
          Ouvrir les actions métier
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {assistantsConfig.map((assistant) => (
          <Link
            key={assistant.slug}
            href={`/tableau-de-bord/assistants/${assistant.slug}`}
            className="rounded-2xl border border-subtle bg-surface-soft p-5 opacity-75 transition hover:opacity-100 hover:shadow-glow"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-xl">{assistant.emoji}</span>
              <div>
                <p className="font-semibold">{assistant.title}</p>
                <p className="text-xs text-muted">Service interne</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{assistant.description}</p>
            <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-electric-500">
              <Sparkles className="h-3.5 w-3.5" />
              Utilisé automatiquement par les actions métier
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
