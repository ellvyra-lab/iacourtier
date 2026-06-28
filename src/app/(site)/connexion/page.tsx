import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { LoginForm } from "@/components/sections/LoginForm";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte IACourtier.ca.",
};

export default function ConnexionPage() {
  return (
    <section className="grid min-h-[calc(100vh-72px)] place-items-center bg-surface-soft py-16">
      <Container className="max-w-md">
        <div className="rounded-3xl border border-subtle bg-surface p-8 shadow-card">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500 to-cyan-500 text-white">
              <Sparkles size={18} />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Bon retour parmi nous
            </h1>
            <p className="text-sm text-muted">
              Connectez-vous pour accéder à votre tableau de bord membre.
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-muted">
            Pas encore membre ?{" "}
            <Link href="/inscription" className="font-medium text-electric-500 hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
