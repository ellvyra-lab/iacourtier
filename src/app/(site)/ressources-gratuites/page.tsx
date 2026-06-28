import type { Metadata } from "next";
import { Download, FileText, PlayCircle, BookOpen } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Ressources gratuites",
  description:
    "Guides, gabarits et formations d'introduction gratuits pour découvrir l'IA appliquée au courtage immobilier.",
};

const resources = [
  {
    icon: FileText,
    title: "Guide : 10 modèles essentiels pour courtiers",
    description: "Un PDF avec les 10 modèles les plus utilisés par nos membres.",
    type: "PDF",
  },
  {
    icon: PlayCircle,
    title: "Formation d'introduction à l'IA",
    description: "Une vidéo de 25 minutes pour comprendre les bases sans jargon.",
    type: "Vidéo",
  },
  {
    icon: BookOpen,
    title: "Gabarit de fiche Centris",
    description: "Un modèle structuré pour rédiger vos descriptions plus rapidement.",
    type: "Gabarit",
  },
  {
    icon: Download,
    title: "Calendrier de contenu 30 jours",
    description: "Un plan prêt à l'emploi pour vos réseaux sociaux.",
    type: "Gabarit",
  },
];

export default function RessourcesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Ressources gratuites"
        title="Commencez sans rien débourser."
        subtitle="Des guides et gabarits pour découvrir comment l'IA peut transformer votre pratique, dès aujourd'hui."
      />

      <section className="bg-surface py-20">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2">
            {resources.map((r) => (
              <div
                key={r.title}
                className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-7"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                  <r.icon size={20} />
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  {r.type}
                </span>
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-muted">{r.description}</p>
                <Button variant="secondary" size="sm" className="mt-auto w-fit">
                  Télécharger gratuitement
                </Button>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
