import { NextResponse } from "next/server";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { authenticated: false, error: "La configuration Supabase Auth est incomplète." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    const isSignedOut = isAuthSessionMissingError(error) || [400, 401, 403].includes(error.status || 0);
    return NextResponse.json(
      {
        authenticated: false,
        error: isSignedOut
          ? "Ta session a expiré."
          : "La vérification de session est temporairement indisponible.",
      },
      { status: isSignedOut ? 401 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: "Ta session a expiré." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: String(user.user_metadata?.full_name || user.email?.split("@")[0] || user.id.slice(0, 8)).split(/\s+/)[0],
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
