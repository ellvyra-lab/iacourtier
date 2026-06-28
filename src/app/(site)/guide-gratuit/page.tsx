import type { Metadata } from "next";
import { BookOpen, FileQuestion, Layers, ListChecks } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { GuideGratuitSection } from "@/components/sections/GuideGratuitSection";

export const metadata: Metadata = {
  title: "Guide gratuit — L'IA expliquée aux courtiers immobiliers",
  description:
    "Téléchargez gratuitement le guide complet de 56 pages sur l'intelligence artificielle pour les courtiers immobiliers du Québec : prompts, outils, erreurs à éviter et études de cas.",
};

const inside = [
  { icon: BookOpen, title: "13 chapitres complets", text: "De « c'est quoi un prompt » jusqu'aux automatisations avancées." },
  { icon: ListChecks, title: "30 prompts prêts à l'emploi", text: "Classés par catégorie : descriptions, courriels, objections, prospection." },
  { icon: FileQuestion, title: "Les 25 erreurs à éviter", text: "Celles qui font perdre du temps, et celles qui peuvent coûter un client." },
  { icon: Layers, title: "3 études de cas réelles", text: "Vendeur pressé, premier acheteur, investisseur — du début à la fin." },
];

export default function GuideGratuitPage() {
  return (
    <>
      <PageHeader
        eyebrow="100% gratuit"
        title="L'IA expliquée aux courtiers immobiliers."
        subtitle="56 pages pour comprendre l'intelligence artificielle, sans jargon technique, avec des exemples qui ressemblent à votre semaine de courtier."
      />

      <section className="bg-surface py-16">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {inside.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface-soft p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                  <item.icon size={20} />
                </span>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <GuideGratuitSection source="guide-gratuit-page" />
    </>
  );
}
