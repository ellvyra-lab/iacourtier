import type { Metadata } from "next";
import { Clock, Layers, Bell } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { formations } from "@/data/formations";
import { LeadForm } from "@/components/sections/LeadForm";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Formations (bientôt disponible)",
  description:
    "Des formations concrètes pour maîtriser l'intelligence artificielle appliquée au courtage immobilier québécois — lancement à venir.",
};

const levelColor: Record<string, string> = {
  Débutant: "text-cyan-500 bg-cyan-500/10",
  Intermédiaire: "text-electric-500 bg-electric-500/10",
  Avancé: "text-purple-400 bg-purple-400/10",
};

export default function FormationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Formations"
        title="Apprenez en pratiquant, pas en théorie."
        subtitle="Chaque formation est construite à partir de vrais cas de courtage québécois, des bases de l'IA jusqu'aux automatisations avancées."
      />

      <section className="bg-surface py-20">
        <Container>
          <div className="mb-10 flex flex-col items-center gap-4 rounded-2xl border border-electric-500/30 bg-electric-500/5 p-8 text-center">
            <span className="flex items-center gap-2 rounded-full bg-electric-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-electric-500">
              <Bell size={13} />
              Bientôt disponible
            </span>
            <p className="max-w-md text-balance text-lg font-medium">
              Les formations sont en finalisation. Inscrivez-vous pour être
              averti dès le lancement et recevoir un accès prioritaire.
            </p>
            <div className="w-full max-w-sm">
              <LeadForm
                source="formations-waitlist"
                buttonLabel="Être averti au lancement"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((f) => (
              <div
                key={f.slug}
                className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-subtle bg-surface-soft p-7 opacity-75"
              >
                <span className="absolute right-4 top-4 rounded-full bg-[var(--ink)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Bientôt
                </span>
                <div className="flex flex-col gap-3">
                  <span
                    className={cn(
                      "w-fit rounded-full px-3 py-1 text-xs font-medium",
                      levelColor[f.level]
                    )}
                  >
                    {f.level}
                  </span>
                  <p className="text-lg font-semibold leading-snug">{f.title}</p>
                  <p className="text-sm text-muted">{f.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-subtle pt-4 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} /> {f.duration}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers size={14} /> {f.modules} modules
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
