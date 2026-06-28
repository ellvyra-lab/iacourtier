"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Lock, User, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/tableau-de-bord`
              : undefined,
        },
      });

      if (signUpError) {
        setLoading(false);
        setError(
          signUpError.message === "User already registered"
            ? "Un compte existe déjà avec ce courriel."
            : signUpError.message
        );
        return;
      }

      setLoading(false);

      // If Supabase email confirmation is enabled (the default), there's no
      // active session yet — show a "check your inbox" state. If it's
      // disabled, a session comes back immediately and we go straight in.
      if (data.session) {
        router.push("/tableau-de-bord");
        router.refresh();
      } else {
        setNeedsConfirmation(true);
      }
    } catch {
      setLoading(false);
      setError(
        "Le service d'inscription n'est pas encore configuré. Contactez l'administrateur du site."
      );
    }
  }

  if (needsConfirmation) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-subtle bg-surface-soft p-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
          <CheckCircle2 size={22} />
        </span>
        <p className="font-semibold">Vérifiez votre courriel</p>
        <p className="text-sm text-muted">
          Nous avons envoyé un lien de confirmation à <strong>{email}</strong>.
          Cliquez sur ce lien pour activer votre compte.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium">
          Nom complet
        </label>
        <div className="relative">
          <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre nom"
            className="w-full rounded-xl border border-subtle bg-surface px-11 py-3 text-sm outline-none focus-visible:border-electric-500"
          />
        </div>
      </div>

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
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@courtier.ca"
            className="w-full rounded-xl border border-subtle bg-surface px-11 py-3 text-sm outline-none focus-visible:border-electric-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
        </label>
        <div className="relative">
          <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6 caractères minimum"
            className="w-full rounded-xl border border-subtle bg-surface px-11 py-3 text-sm outline-none focus-visible:border-electric-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" size="lg" className="w-full justify-center">
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Création en cours...
          </>
        ) : (
          <>
            Créer mon compte
            <UserPlus size={16} />
          </>
        )}
      </Button>
    </form>
  );
}
