"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/tableau-de-bord/parametres`
            : undefined,
      });

      setLoading(false);

      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch {
      setLoading(false);
      setError(
        "Le service de réinitialisation n'est pas encore configuré. Contactez l'administrateur du site."
      );
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
          <CheckCircle2 size={22} />
        </span>
        <p className="font-semibold">Courriel envoyé</p>
        <p className="text-sm text-muted">
          Si un compte existe pour <strong>{email}</strong>, un lien de
          réinitialisation vient d&apos;être envoyé.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Courriel
        </label>
        <div className="relative">
          <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@courtier.ca"
            className="w-full rounded-xl border border-subtle bg-surface px-11 py-3 text-sm outline-none focus-visible:border-electric-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" size="lg" className="w-full justify-center">
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Envoi en cours...
          </>
        ) : (
          <>
            Envoyer le lien
            <Send size={16} />
          </>
        )}
      </Button>
    </form>
  );
}
