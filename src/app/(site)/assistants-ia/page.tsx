import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssistantsShowcase } from "@/components/sections/AssistantsShowcase";

export const metadata: Metadata = {
  title: "Assistants IA",
  description:
    "Des assistants IA simples et prêts à l'emploi pour les courtiers immobiliers du Québec : descriptions, publications, courriels, prospection et plus.",
};

export default function AssistantsIAPage() {
  return (
    <>
      <PageHeader
        eyebrow="Assistants IA"
        title="L'IA, sans la complexité."
        subtitle="Pas de jargon technique à apprendre. Choisissez un assistant, répondez à quelques questions, obtenez votre résultat."
      />
      <AssistantsShowcase showHeading={false} showCta={false} />
    </>
  );
}
