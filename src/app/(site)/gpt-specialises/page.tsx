import type { Metadata } from "next";
import { Bot, Check, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "GPT spécialisés",
  description:
    "Des assistants IA pré-configurés pour le courtage immobilier québécois : descriptions Centris, prospection, réseaux sociaux, négociation et service client.",
};

const gpts = [
  {
    name: "GPT Description Centris",
    text: "Génère des fiches descriptives optimisées pour Centris en quelques secondes, pour tout type de propriété — maison, condo, multiplex, terrain ou commercial.",
    bullets: ["Respecte votre style et votre ton", "S'adapte à chaque type de propriété", "Prêt à publier, sans réécriture"],
  },
  {
    name: "GPT Script de prospection",
    text: "Crée des scripts d'appel adaptés à chaque type de prospect, du propriétaire hésitant à l'investisseur actif.",
    bullets: ["Scripts personnalisés par profil", "Ton naturel, jamais robotique", "Variantes pour chaque objection"],
  },
  {
    name: "GPT Réseaux sociaux",
    text: "Planifie et rédige vos publications hebdomadaires en respectant votre ton de marque, pour Facebook, Instagram et TikTok.",
    bullets: ["Calendrier de contenu en quelques minutes", "Légendes et scripts vidéo inclus", "Cohérence de marque garantie"],
  },
  {
    name: "GPT Négociation",
    text: "Aide à formuler des réponses posées lors de négociations délicates, sans jamais sonner défensif.",
    bullets: ["Réponses aux objections de prix", "Ton diplomate et professionnel", "Adapté aux situations sensibles"],
  },
  {
    name: "GPT Service client",
    text: "Répond aux questions fréquentes de vos clients avec votre ton habituel, à toute heure du jour.",
    bullets: ["Disponible 24/7", "Réponses cohérentes avec votre image", "Réduit le temps de réponse"],
  },
];

export default function GptSpecialisesPage() {
  return (
    <>
      <PageHeader
        eyebrow="GPT spécialisés"
        title="Le raccourci ultime pour ne plus réécrire le même prompt deux fois."
        subtitle="Des assistants IA pré-configurés pour le courtage immobilier québécois — vous décrivez votre besoin, ils appliquent automatiquement vos standards."
      />

      <section className="bg-surface py-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-2">
            {gpts.map((gpt) => (
              <div
                key={gpt.name}
                className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-7"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500/15 to-cyan-500/15 text-electric-500">
                  <Bot size={22} />
                </span>
                <p className="text-lg font-semibold">{gpt.name}</p>
                <p className="text-sm text-muted">{gpt.text}</p>
                <ul className="flex flex-col gap-2 border-t border-subtle pt-4">
                  {gpt.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted">
                      <Check size={15} className="mt-0.5 shrink-0 text-cyan-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl border border-subtle bg-surface-soft p-10 text-center">
            <p className="max-w-md text-balance text-2xl font-semibold tracking-tight">
              Accédez à tous les GPT spécialisés avec un forfait IACourtier.
            </p>
            <p className="max-w-xl text-muted">
              Inclus dans les forfaits Essentiel et Pro, avec mises à jour
              régulières basées sur les retours des membres.
            </p>
            <Button href="/tarifs" size="lg">
              Voir les forfaits
              <ArrowRight size={16} />
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
