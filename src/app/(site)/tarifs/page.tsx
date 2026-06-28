import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Choisissez le forfait IACourtier.ca adapté à votre pratique : formations, assistants IA, automatisations et ressources.",
};

const plans = [
  {
    name: "Découverte",
    price: "0$",
    period: "pour toujours",
    description: "Pour tester la plateforme avant de vous engager.",
    features: [
      "Accès à 25 modèles prêts à l'emploi",
      "1 formation d'introduction",
      "Accès à la communauté",
    ],
    cta: "Commencer gratuitement",
    highlighted: false,
  },
  {
    name: "Essentiel",
    price: "47$",
    period: "/ mois",
    description: "Pour les courtiers qui veulent intégrer l'IA au quotidien.",
    features: [
      "Bibliothèque complète de modèles",
      "Toutes les formations",
      "20 automatisations incluses",
      "Support par courriel",
    ],
    cta: "Essayer gratuitement",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "97$",
    period: "/ mois",
    description: "Pour les équipes et courtiers à fort volume.",
    features: [
      "Tout le forfait Essentiel",
      "Automatisations illimitées",
      "Assistants IA avancés",
      "Accès prioritaire au soutien",
    ],
    cta: "Choisir Pro",
    highlighted: false,
  },
  {
    name: "Équipe",
    price: "Sur mesure",
    period: "",
    description: "Pour les équipes de courtage et franchises.",
    features: [
      "Comptes multiples",
      "Formation d'équipe personnalisée",
      "Intégrations CRM dédiées",
      "Gestionnaire de compte dédié",
    ],
    cta: "Nous contacter",
    highlighted: false,
  },
];

export default function TarifsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Tarifs"
        title="Un forfait pour chaque étape de votre pratique."
        subtitle="Aucun engagement à long terme. Modifiez ou annulez votre abonnement à tout moment depuis votre tableau de bord."
      />

      <section className="bg-surface py-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "flex flex-col gap-6 rounded-3xl border p-7",
                  plan.highlighted
                    ? "signature-edge border-electric-500/40 bg-gradient-to-br from-electric-500/[0.06] to-cyan-500/[0.06] shadow-glow"
                    : "border-subtle bg-surface-soft"
                )}
              >
                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="mt-3 text-sm text-muted">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </div>

                <Button
                  href={plan.name === "Équipe" ? "/contact" : "/connexion"}
                  variant={plan.highlighted ? "primary" : "secondary"}
                  className="w-full"
                >
                  {plan.cta}
                </Button>

                <ul className="flex flex-col gap-3 border-t border-subtle pt-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted">
                      <Check size={16} className="mt-0.5 shrink-0 text-cyan-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted">
            Prix en dollars canadiens, taxes en sus. Annulation possible à
            tout moment.
          </p>
        </Container>
      </section>
    </>
  );
}
