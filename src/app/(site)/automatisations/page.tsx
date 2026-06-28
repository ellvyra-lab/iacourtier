import type { Metadata } from "next";
import { Bell, Megaphone, Target, FileBarChart, Home, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Automatisations",
  description:
    "Automatisez vos tâches répétitives pour gagner du temps et vous concentrer sur vos clients — sans aucune connaissance technique.",
};

const automations = [
  {
    icon: Bell,
    title: "Relance automatique",
    result: "Ne perdez plus jamais un client par manque de suivi.",
    text: "Un message part automatiquement quelques jours après une visite sans réponse.",
  },
  {
    icon: Megaphone,
    title: "Publication planifiée",
    result: "Restez présent sur les réseaux sans y penser.",
    text: "Votre contenu se publie seul, selon le calendrier que vous avez préparé.",
  },
  {
    icon: Target,
    title: "Priorisation des prospects",
    result: "Sachez toujours qui appeler en premier.",
    text: "Vos meilleurs prospects sont classés automatiquement, chaque nuit.",
  },
  {
    icon: FileBarChart,
    title: "Rapport hebdomadaire",
    result: "Gardez une vue claire de votre semaine.",
    text: "Un résumé de votre activité vous attend chaque lundi matin, sans rien préparer.",
  },
  {
    icon: Home,
    title: "Alerte nouvelle inscription",
    result: "Soyez le premier à informer vos clients investisseurs.",
    text: "Vos clients reçoivent une alerte dès qu'une propriété correspond à leurs critères.",
  },
];

export default function AutomatisationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Automatisations"
        title="Automatisez vos tâches répétitives."
        subtitle="Gagnez du temps pour vous concentrer sur vos clients — chaque automatisation tourne en arrière-plan, sans aucune connaissance technique."
      />

      <section className="bg-surface py-20">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2">
            {automations.map((a) => (
              <div
                key={a.title}
                className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface-soft p-7"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500/15 to-cyan-500/15 text-electric-500">
                  <a.icon size={22} />
                </span>
                <p className="text-lg font-semibold">{a.title}</p>
                <p className="text-sm font-medium text-electric-500">{a.result}</p>
                <p className="text-sm text-muted">{a.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl border border-subtle bg-surface-soft p-10 text-center">
            <p className="max-w-md text-balance text-2xl font-semibold tracking-tight">
              Une seule automatisation suffit pour commencer.
            </p>
            <p className="max-w-xl text-muted">
              Choisissez celle qui vous coûte le plus de temps cette semaine —
              le reste s&apos;ajoute naturellement, au fil de vos besoins.
            </p>
            <Button href="/inscription" size="lg">
              Commencer gratuitement
              <ArrowRight size={16} />
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
