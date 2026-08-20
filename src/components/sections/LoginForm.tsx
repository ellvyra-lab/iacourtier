"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const reason = searchParams.get("error");
    if (reason === "auth_configuration") {
      setError("L’authentification Supabase n’est pas configurée sur ce déploiement. Ajoutez les variables Supabase dans Vercel avant de créer ou connecter un compte.");
    } else if (reason === "auth_callback") {
      setError("Le lien de confirmation est invalide ou expiré. Recommencez la connexion ou l’inscription.");
    } else if (reason === "auth_unavailable") {
      setError("Supabase est temporairement indisponible. Ta session n’a pas été supprimée; réessaie dans un instant.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!isSupabaseBrowserConfigured()) {
        throw new Error("auth_configuration");
      }
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setLoading(false);
        setError(
          signInError.message === "Invalid login credentials"
            ? "Courriel ou mot de passe incorrect."
            : signInError.message
        );
        return;
      }

      if (!data.session) {
        setLoading(false);
        setError("La connexion n’a pas retourné de session valide.");
        return;
      }

      // signInWithPassword writes the same @supabase/ssr cookies consumed by
      // middleware and API routes. Verify once before navigating so the first
      // protected upload cannot race cookie persistence.
      await supabase.auth.getUser();
      const verification = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      }).catch(() => null);
      if (!verification?.ok) {
        setLoading(false);
        setError(verification?.status === 503
          ? "La session existe, mais le serveur ne peut pas la confirmer pour le moment. Réessaie dans un instant."
          : "La connexion n’a pas pu être confirmée par le serveur.");
        return;
      }

      const requestedPath = searchParams.get("next");
      const next = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/tableau-de-bord";
      router.replace(next);
      router.refresh();
    } catch {
      setLoading(false);
      setError(
        "Le service de connexion n'est pas encore configuré. Contactez l'administrateur du site."
      );
    }
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
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@courtier.ca"
            className="w-full rounded-xl border border-subtle bg-surface px-11 py-3 text-sm outline-none focus-visible:border-electric-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            Mot de passe
          </label>
          <a href="/mot-de-passe-oublie" className="text-xs text-electric-500 hover:underline">
            Mot de passe oublié ?
          </a>
        </div>
        <div className="relative">
          <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-subtle bg-surface px-11 py-3 text-sm outline-none focus-visible:border-electric-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" size="lg" className="w-full justify-center">
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Connexion en cours...
          </>
        ) : (
          <>
            Se connecter
            <LogIn size={16} />
          </>
        )}
      </Button>
    </form>
  );
}
