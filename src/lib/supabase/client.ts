import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

// Used in "use client" components (login form, signup form, logout button).
// Reads the same public env vars as the server client below.
//
// Falls back to harmless placeholder values when Supabase isn't configured
// yet, so the app never crashes during build or before someone fills in
// .env.local. Callers can validate the actual values before attempting
// authentication, instead of treating truncated values as configured.
export function getSupabaseBrowserConfigurationError() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return "La configuration Supabase est incomplète : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont obligatoires.";
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    const isLocal = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
    if (parsedUrl.protocol !== "https:" && !isLocal) {
      return "NEXT_PUBLIC_SUPABASE_URL est invalide : l’URL Supabase doit utiliser HTTPS.";
    }
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL est invalide : entrez l’URL complète du projet Supabase.";
  }

  const publishablePrefix = "sb_publishable_";
  const hasCompletePublishableKey =
    supabaseAnonKey.startsWith(publishablePrefix) &&
    supabaseAnonKey.slice(publishablePrefix.length).length >= 16;
  const jwtParts = supabaseAnonKey.split(".");
  const hasLegacyAnonKey =
    jwtParts.length === 3 && jwtParts.every((part) => part.length > 0);

  if (!hasCompletePublishableKey && !hasLegacyAnonKey) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY est invalide ou incomplète : copiez la clé publique complète (sb_publishable_…) ou la clé anon héritée.";
  }

  return null;
}

export function isSupabaseBrowserConfigured() {
  return getSupabaseBrowserConfigurationError() === null;
}

export function describeSupabaseBrowserError(error: unknown, fallback: string) {
  const originalMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (/failed to fetch|fetch failed|networkerror/i.test(originalMessage)) {
    return `Impossible de joindre le projet Supabase configuré (${supabaseUrl}). Erreur originale : ${originalMessage}`;
  }

  return originalMessage || fallback;
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-anon-key",
    {
      // @supabase/ssr already caches the browser client. Keeping these
      // settings explicit documents the contract shared by login and every
      // dashboard feature: one cookie-backed session, persisted and refreshed
      // by the SDK rather than component-local auth state.
      // Do not cache during server rendering: a server singleton could leak
      // auth state between requests. In the browser, every caller receives
      // the one shared client maintained by @supabase/ssr.
      isSingleton: typeof window !== "undefined",
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  );
}
