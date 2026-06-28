import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { BlogList } from "@/components/sections/BlogList";

export const metadata: Metadata = {
  title: "Blogue",
  description:
    "Conseils pratiques sur l'IA appliquée au courtage immobilier québécois : prospection, marketing, outils et rédaction.",
};

export default function BlogPage() {
  return (
    <>
      <PageHeader
        eyebrow="Blogue"
        title="Des idées concrètes, pas de théorie."
        subtitle="Des articles courts et pratiques pour intégrer l'IA dans votre pratique de courtage, une idée à la fois."
      />

      <section className="bg-surface py-20">
        <Container>
          <BlogList />
        </Container>
      </section>
    </>
  );
}
