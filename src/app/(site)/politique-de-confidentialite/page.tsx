import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité d'IACourtier.ca.",
};

export default function PolitiqueConfidentialitePage() {
  return (
    <>
      <PageHeader
        eyebrow="Légal"
        title="Politique de confidentialité"
      />
      <section className="bg-surface py-16">
        <Container className="max-w-2xl space-y-8 text-sm text-muted">
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Données collectées
            </h2>
            <p>
              Nous recueillons les informations que vous nous fournissez
              volontairement (nom, courriel) lors de votre inscription ou de
              l&apos;envoi d&apos;un formulaire de contact.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Utilisation des données
            </h2>
            <p>
              Vos informations servent uniquement à vous donner accès à votre
              compte, à vous contacter au sujet de votre abonnement, et à
              améliorer nos services. Elles ne sont jamais vendues à des
              tiers.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Cookies
            </h2>
            <p>
              Le site utilise des cookies essentiels au fonctionnement de la
              plateforme et, avec votre consentement, des cookies de mesure
              d&apos;audience.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Vos droits
            </h2>
            <p>
              Vous pouvez demander l&apos;accès, la correction ou la
              suppression de vos données personnelles en nous contactant à
              info@iacourtier.ca.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
