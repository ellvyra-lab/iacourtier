import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ForgotPasswordForm } from "@/components/sections/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  description: "Réinitialisez votre mot de passe IACourtier.ca.",
};

export default function MotDePasseOubliePage() {
  return (
    <section className="grid min-h-[calc(100vh-72px)] place-items-center bg-surface-soft py-16">
      <Container className="max-w-md">
        <div className="rounded-3xl border border-subtle bg-surface p-8 shadow-card">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500 to-cyan-500 text-white">
              <KeyRound size={18} />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Mot de passe oublié
            </h1>
            <p className="text-sm text-muted">
              Entrez votre courriel pour recevoir un lien de réinitialisation.
            </p>
          </div>

          <ForgotPasswordForm />

          <p className="mt-6 text-center text-sm text-muted">
            <Link href="/connexion" className="font-medium text-electric-500 hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
