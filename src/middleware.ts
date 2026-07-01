import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Runs on every request. Two jobs:
//   1. Keep the Supabase session cookie fresh (required for SSR auth).
//   2. Redirect signed-out visitors away from /tableau-de-bord to /connexion,
//      and signed-in visitors away from /connexion or /inscription to the
//      dashboard, so they never see a login form while already logged in.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Auth isn't configured yet (no Supabase project linked) — let every
  // request through untouched rather than locking the dashboard out.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isLoggedIn = !!data.user;

  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith("/tableau-de-bord");
  const isAuthPage = pathname === "/connexion" || pathname === "/inscription";
  const isHomePage = pathname === "/";

  if (isDashboard && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/tableau-de-bord";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isHomePage && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/tableau-de-bord";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/tableau-de-bord/:path*",
    "/",
    "/connexion",
    "/inscription",
  ],
};
