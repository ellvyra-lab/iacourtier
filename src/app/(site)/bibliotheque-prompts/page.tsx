import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { PromptLibrary } from "@/components/sections/PromptLibrary";

export const metadata: Metadata = {
  title: "Bibliothèque de prompts",
  description:
    "Plus de 1000 prompts prêts à l'emploi pour la prospection, la rédaction, les réseaux sociaux, la négociation et le CRM.",
};

export default function PromptsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Bibliothèque"
        title="1000+ prompts prêts à l'emploi."
        subtitle="Un aperçu de notre bibliothèque. Les membres ont accès à la collection complète, organisée par tâche et par situation."
      />

      <section className="bg-surface py-20">
        <Container>
          <PromptLibrary />
        </Container>
      </section>
    </>
  );
}
