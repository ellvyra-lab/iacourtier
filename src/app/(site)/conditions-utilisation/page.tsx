import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Conditions d'utilisation d'IACourtier.ca.",
};

export default function ConditionsUtilisationPage() {
  return (
    <>
      <PageHeader eyebrow="Légal" title="Conditions d'utilisation" />
      <section className="bg-surface py-16">
        <Container className="max-w-2xl space-y-8 text-sm text-muted">
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Acceptation des conditions
            </h2>
            <p>
              En accédant à IACourtier.ca ou en utilisant un de ses forfaits,
              vous acceptez les présentes conditions d&apos;utilisation.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Utilisation du contenu
            </h2>
            <p>
              Les formations, prompts, gabarits et automatisations sont
              destinés à un usage personnel dans le cadre de votre pratique
              de courtage. La revente ou la redistribution du contenu sans
              autorisation est interdite.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Abonnements et annulation
            </h2>
            <p>
              Les forfaits payants sont facturés mensuellement et peuvent
              être annulés à tout moment depuis le tableau de bord membre,
              sans pénalité.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Limitation de responsabilité
            </h2>
            <p>
              IACourtier.ca fournit des outils d&apos;aide à la pratique du
              courtage, mais ne garantit pas de résultats commerciaux
              spécifiques. Les décisions d&apos;affaires demeurent sous votre
              responsabilité.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
