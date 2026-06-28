import type { Metadata } from "next";
import { MessageCircle, Users, CalendarDays } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Communauté",
  description:
    "Rejoignez la communauté de courtiers québécois qui utilisent l'IA pour transformer leur pratique.",
};

const highlights = [
  {
    icon: Users,
    title: "500+ membres actifs",
    text: "Des courtiers de partout au Québec qui partagent leurs réussites et leurs questions.",
  },
  {
    icon: MessageCircle,
    title: "Échanges quotidiens",
    text: "Posez vos questions et obtenez des réponses concrètes, souvent en quelques minutes.",
  },
  {
    icon: CalendarDays,
    title: "Rencontres mensuelles",
    text: "Des sessions en direct pour approfondir un outil ou une stratégie chaque mois.",
  },
];

export default function CommunautePage() {
  return (
    <>
      <PageHeader
        eyebrow="Communauté"
        title="Vous n'êtes plus seul à apprendre l'IA."
        subtitle="Une communauté privée de courtiers québécois qui s'entraident pour intégrer l'IA dans leur pratique."
      />

      <section className="bg-surface py-20">
        <Container>
          <div className="grid gap-6 sm:grid-cols-3">
            {highlights.map((h) => (
              <div
                key={h.title}
                className="rounded-2xl border border-subtle bg-surface-soft p-7 text-center"
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                  <h.icon size={20} />
                </span>
                <p className="mt-4 font-semibold">{h.title}</p>
                <p className="mt-2 text-sm text-muted">{h.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center gap-4 rounded-3xl border border-subtle bg-surface-soft p-10 text-center">
            <p className="text-2xl font-semibold tracking-tight">
              Joignez-vous gratuitement à la communauté.
            </p>
            <p className="max-w-xl text-muted">
              L&apos;accès à la communauté est inclus dans tous les forfaits,
              y compris le forfait Découverte gratuit.
            </p>
            <Button href="/tarifs" size="lg">
              Rejoindre la communauté
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
