import { createBrowserClient } from "@supabase/ssr";

// Used in "use client" components (login form, signup form, logout button).
// Reads the same public env vars as the server client below.
//
// Falls back to harmless placeholder values when Supabase isn't configured
// yet, so the app never crashes during build or before someone fills in
// .env.local. Callers can use isSupabaseBrowserConfigured() to show a clear
// configuration error before attempting authentication.
export function isSupabaseBrowserConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
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
