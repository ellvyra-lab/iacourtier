import type { Metadata } from "next";
import { Download, Sparkles, Rocket, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Débuter",
  description:
    "Trois étapes simples pour commencer à gagner du temps avec l'IA, sans aucune connaissance technique.",
};

const steps = [
  {
    icon: Download,
    title: "1. Recevez le guide gratuit",
    text: "56 pages simples, sans jargon, pour comprendre ce que l'IA peut faire pour vous.",
    href: "/guide-gratuit",
    cta: "Télécharger le guide",
  },
  {
    icon: Sparkles,
    title: "2. Essayez un premier assistant",
    text: "Commencez par celui qui répond à votre besoin le plus urgent cette semaine.",
    href: "/assistants-ia",
    cta: "Voir les assistants",
  },
  {
    icon: Rocket,
    title: "3. Créez votre compte",
    text: "Accédez à tous les assistants et automatisations dès aujourd'hui.",
    href: "/inscription",
    cta: "Commencer gratuitement",
  },
];

export default function DebuterPage() {
  return (
    <>
      <PageHeader
        eyebrow="Débuter"
        title="Par où commencer ?"
        subtitle="Pas besoin d'être technique. Voici les trois étapes que suivent la plupart de nos membres pour démarrer."
      />

      <section className="bg-surface py-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.title}
                className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-7"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                  <s.icon size={20} />
                </span>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted">{s.text}</p>
                <Button href={s.href} variant="secondary" size="sm" className="mt-auto w-fit">
                  {s.cta}
                  <ArrowRight size={14} />
                </Button>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
