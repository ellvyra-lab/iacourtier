import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales d'IACourtier.ca.",
};

export default function MentionsLegalesPage() {
  return (
    <>
      <PageHeader eyebrow="Légal" title="Mentions légales" />
      <section className="bg-surface py-16">
        <Container className="max-w-2xl space-y-8 text-sm text-muted">
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Éditeur du site
            </h2>
            <p>
              IACourtier.ca est édité par Sonia Bernier, opérant sous
              Viaduo.ca, dans la région de Lanaudière, Québec, Canada.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Hébergement
            </h2>
            <p>Le site est hébergé sur l&apos;infrastructure Vercel Inc.</p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Propriété intellectuelle
            </h2>
            <p>
              L&apos;ensemble des contenus présents sur IACourtier.ca
              (textes, formations, prompts, visuels) est protégé par le droit
              d&apos;auteur et ne peut être reproduit sans autorisation
              écrite.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
              Responsabilité
            </h2>
            <p>
              IACourtier.ca s&apos;efforce de fournir des informations exactes
              mais ne peut être tenu responsable des décisions d&apos;affaires
              prises sur la base des contenus du site.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
