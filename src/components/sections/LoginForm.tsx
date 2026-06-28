"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
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

      const next = searchParams.get("next") || "/tableau-de-bord";
      router.push(next);
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
