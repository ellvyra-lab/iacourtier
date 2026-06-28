import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="grid min-h-[70vh] place-items-center bg-surface">
      <Container className="flex flex-col items-center gap-5 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-electric-500">
          Erreur 404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Cette page n&apos;existe pas.
        </h1>
        <p className="max-w-md text-muted">
          La page que vous cherchez a peut-être été déplacée ou
          n&apos;existe plus. Revenez à l&apos;accueil pour continuer votre
          navigation.
        </p>
        <Button href="/">Retour à l&apos;accueil</Button>
      </Container>
    </section>
  );
}
