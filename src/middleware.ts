import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Runs on every request. Two jobs:
//   1. Keep the Supabase session cookie fresh (required for SSR auth).
//   2. Redirect signed-out visitors away from private routes to /connexion,
//      and signed-in visitors away from /connexion or /inscription to the
//      dashboard, so they never see a login form while already logged in.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname, search } = request.nextUrl;
  const isDashboard = pathname.startsWith("/tableau-de-bord");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPrivatePage = isDashboard || isAdmin;
  const isAuthPage = pathname === "/connexion" || pathname === "/inscription";
  const isHomePage = pathname === "/";

  // Never silently expose the private dashboard when the production Auth
  // configuration is incomplete. Public pages can still render an explicit
  // configuration error from their own UI.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isPrivatePage) {
      const url = request.nextUrl.clone();
      url.pathname = "/connexion";
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      url.searchParams.set("error", "auth_configuration");
      return NextResponse.redirect(url);
    }
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

  const { data, error } = await supabase.auth.getUser();
  if (error && !isSignedOutError(error)) {
    // A transient Supabase/network failure is not a logout. Keep the cookies,
    // but fail closed so no account chrome is rendered without verification.
    if (isPrivatePage) {
      const url = request.nextUrl.clone();
      url.pathname = "/connexion";
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      url.searchParams.set("error", "auth_unavailable");
      return redirectWithRefreshedCookies(url, response);
    }
    return response;
  }
  const isLoggedIn = !!data.user;

  if (isPrivatePage && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectWithRefreshedCookies(url, response);
  }

  if (isAuthPage && isLoggedIn) {
    const next = safeLocalPath(request.nextUrl.searchParams.get("next"));
    const url = next ? new URL(next, request.url) : request.nextUrl.clone();
    if (!next) {
      url.pathname = "/tableau-de-bord";
      url.search = "";
    }
    return redirectWithRefreshedCookies(url, response);
  }

  if (isHomePage && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/tableau-de-bord";
    url.search = "";
    return redirectWithRefreshedCookies(url, response);
  }

  return response;
}

function isSignedOutError(error: { status?: number; name?: string }) {
  return error.name === "AuthSessionMissingError" || [400, 401, 403].includes(error.status || 0);
}

function redirectWithRefreshedCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

function safeLocalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/connexion" || value === "/inscription") return null;
  return value;
}

export const config = {
  matcher: [
    // Refresh the cookie for page navigation and protected API calls,
    // including multipart document uploads. Static assets are excluded.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

