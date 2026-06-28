import { createBrowserClient } from "@supabase/ssr";

// Used in "use client" components (login form, signup form, logout button).
// Reads the same public env vars as the server client below.
//
// Falls back to harmless placeholder values when Supabase isn't configured
// yet, so the app never crashes during build or before someone fills in
// .env.local — auth calls will simply fail gracefully at runtime instead.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
  );
}
