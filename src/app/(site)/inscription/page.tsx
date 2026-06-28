import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SignupForm } from "@/components/sections/SignupForm";

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Créez votre compte IACourtier.ca.",
};

export default function InscriptionPage() {
  return (
    <section className="grid min-h-[calc(100vh-72px)] place-items-center bg-surface-soft py-16">
      <Container className="max-w-md">
        <div className="rounded-3xl border border-subtle bg-surface p-8 shadow-card">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500 to-cyan-500 text-white">
              <Sparkles size={18} />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Créez votre compte
            </h1>
            <p className="text-sm text-muted">
              Accédez à votre tableau de bord membre IACourtier.
            </p>
          </div>

          <SignupForm />

          <p className="mt-6 text-center text-sm text-muted">
            Déjà membre ?{" "}
            <Link href="/connexion" className="font-medium text-electric-500 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
