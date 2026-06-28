import { createClient } from "@supabase/supabase-js";

// Used ONLY in server-only contexts that have no user session to act as
// (Stripe webhooks). Bypasses Row Level Security — never expose this
// client or the service role key to the browser.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
