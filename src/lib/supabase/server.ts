import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used in Server Components, Server Actions, and Route Handlers — reads
// and writes the auth session via cookies so it stays in sync with the
// browser client.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can be called from a Server Component, where cookies
            // can't be written. Safe to ignore — middleware handles refresh.
          }
        },
      },
    }
  );
}
