"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/client";
import {
  isBrokerOnboardingComplete,
  normalizeBrokerProfile,
  saveBrokerProfile,
  setActiveBrokerProfileUser,
  type BrokerProfile,
} from "@/lib/broker-profile";
import {
  BROKER_PROFILE_SAVED_EVENT,
  loadBrokerProfileFromSupabase,
} from "@/lib/broker-profile-persistence";

export type DashboardAuthStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "error";

type DashboardAuthContextValue = {
  status: DashboardAuthStatus;
  user: User | null;
  verifySession: (forceRefresh?: boolean) => Promise<boolean>;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const DashboardAuthContext = createContext<DashboardAuthContextValue | null>(null);
const RETRY_DELAYS = [0, 180, 500];

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function expiresSoon(expiresAt?: number) {
  return !expiresAt || expiresAt * 1000 <= Date.now() + 90_000;
}

export function DashboardAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<DashboardAuthStatus>("checking");
  const [user, setUser] = useState<User | null>(null);
  const statusRef = useRef<DashboardAuthStatus>("checking");
  const userRef = useRef<User | null>(null);
  const verificationRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);

  const updateState = useCallback((nextStatus: DashboardAuthStatus, nextUser: User | null) => {
    const safeStatus = nextStatus === "authenticated" && !nextUser ? "error" : nextStatus;
    setActiveBrokerProfileUser(safeStatus === "authenticated" ? nextUser?.id || null : null);
    statusRef.current = safeStatus;
    userRef.current = nextUser;
    if (!mountedRef.current) return;
    setStatus(safeStatus);
    setUser(nextUser);
  }, []);

  const runVerification = useCallback(async (forceRefresh: boolean) => {
    if (!isSupabaseBrowserConfigured()) {
      updateState("error", null);
      return false;
    }

    // Keep a previously verified user mounted while refreshing in the
    // background. Only the first read uses the blocking checking screen.
    if (!userRef.current) updateState("checking", null);
    let browserSignedOutReads = 0;
    let serverSignedOutReads = 0;
    let transientFailure = false;

    for (let index = 0; index < RETRY_DELAYS.length; index += 1) {
      if (RETRY_DELAYS[index]) await wait(RETRY_DELAYS[index]);

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        let session = sessionData.session;

        if (sessionError) transientFailure = true;

        if (session && (forceRefresh || expiresSoon(session.expires_at))) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshData.session) session = refreshData.session;
          if (refreshError) transientFailure = true;
        }

        if (session) {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userData.user) {
            updateState("authenticated", userData.user);
            return true;
          }
          if (userError) transientFailure = true;
        } else {
          browserSignedOutReads += 1;
        }

        // The server sees the same cookies as protected API routes. This
        // fallback also lets middleware/route handlers write a refreshed
        // cookie before the next browser-side read.
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (response.ok) {
          const { data: refreshedBrowserSession } = await supabase.auth.getSession();
          const { data: refreshedUserData } = await supabase.auth.getUser();
          const verifiedUser = refreshedUserData.user || refreshedBrowserSession.session?.user || session?.user;
          if (verifiedUser) {
            updateState("authenticated", verifiedUser);
            return true;
          }

          // A 200 response without a browser-verifiable user is not an
          // authenticated state. In particular, never let the dashboard
          // render its account chrome with a null user.
          transientFailure = true;
        }

        if (response.status === 401) serverSignedOutReads += 1;
        else transientFailure = true;
      } catch {
        transientFailure = true;
      }
    }

    const definitelySignedOut = serverSignedOutReads >= 2
      || (browserSignedOutReads === RETRY_DELAYS.length && !transientFailure);
    if (definitelySignedOut && !userRef.current) {
      updateState("unauthenticated", null);
    } else {
      // A network, cold-start or Supabase availability error is not a logout.
      updateState("error", userRef.current);
    }
    return false;
  }, [supabase, updateState]);

  const verifySession = useCallback((forceRefresh = false) => {
    if (!forceRefresh && statusRef.current === "authenticated") {
      return Promise.resolve(true);
    }
    if (verificationRef.current) return verificationRef.current;

    const verification = runVerification(forceRefresh).finally(() => {
      verificationRef.current = null;
    });
    verificationRef.current = verification;
    return verification;
  }, [runVerification]);

  const authenticatedFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const active = await verifySession();
    if (!active) {
      return new Response(JSON.stringify({ error: "Ta session a expiré." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const requestInit = { ...init, credentials: "same-origin" as const };
    let response = await fetch(input, requestInit);
    if (response.status !== 401) return response;

    // A protected request may race the access-token expiry. Refresh with the
    // existing refresh token, then replay the request exactly once.
    const refreshed = await verifySession(true);
    if (!refreshed) return response;

    response = await fetch(input, requestInit);
    if (response.status === 401) updateState("unauthenticated", null);
    return response;
  }, [updateState, verifySession]);

  useEffect(() => {
    mountedRef.current = true;
    void verifySession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
        updateState("authenticated", session.user);
      } else if (event === "SIGNED_OUT") {
        updateState("unauthenticated", null);
      }
    });

    const recheck = () => void verifySession();
    window.addEventListener("online", recheck);
    window.addEventListener("focus", recheck);

    return () => {
      mountedRef.current = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("online", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [supabase, updateState, verifySession]);

  const value = useMemo(() => ({ status, user, verifySession, authenticatedFetch }), [authenticatedFetch, status, user, verifySession]);
  return <DashboardAuthContext.Provider value={value}>{children}</DashboardAuthContext.Provider>;
}

export function useDashboardAuth() {
  const context = useContext(DashboardAuthContext);
  if (!context) throw new Error("useDashboardAuth must be used inside DashboardAuthProvider");
  return context;
}

export function DashboardAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, verifySession } = useDashboardAuth();
  const next = `/connexion?next=${encodeURIComponent(pathname)}`;
  const [profileStatus, setProfileStatus] = useState<"checking" | "complete" | "incomplete">("checking");

  useEffect(() => {
    let active = true;
    if (status !== "authenticated" || !user) {
      setProfileStatus("checking");
      return () => { active = false; };
    }
    const authenticatedUser = user;

    async function verifyProfessionalProfile() {
      try {
        const databaseProfile = await loadBrokerProfileFromSupabase();
        if (!active) return;
        if (databaseProfile) saveBrokerProfile(databaseProfile, authenticatedUser.id);
        setProfileStatus(
          databaseProfile && isBrokerOnboardingComplete(databaseProfile)
            ? "complete"
            : "incomplete",
        );
      } catch (profileError) {
        console.error("[professional-profile] Dashboard verification failed", profileError);
        if (!active) return;
        const legacyProfile = normalizeBrokerProfile(authenticatedUser.user_metadata?.broker_profile);
        if (isBrokerOnboardingComplete(legacyProfile)) {
          saveBrokerProfile(legacyProfile, authenticatedUser.id);
          setProfileStatus("complete");
        } else {
          setProfileStatus("incomplete");
        }
      }
    }

    setProfileStatus("checking");
    void verifyProfessionalProfile();
    return () => { active = false; };
  }, [status, user]);

  useEffect(() => {
    function profileSaved(event: Event) {
      const profile = (event as CustomEvent<BrokerProfile>).detail;
      if (!user || !profile) return;
      saveBrokerProfile(profile, user.id);
      setProfileStatus(isBrokerOnboardingComplete(profile) ? "complete" : "incomplete");
    }
    window.addEventListener(BROKER_PROFILE_SAVED_EVENT, profileSaved);
    return () => window.removeEventListener(BROKER_PROFILE_SAVED_EVENT, profileSaved);
  }, [user]);

  const needsOnboarding = profileStatus === "incomplete";

  useEffect(() => {
    if (status === "authenticated" && user && needsOnboarding && pathname !== "/tableau-de-bord/bienvenue") {
      router.replace("/tableau-de-bord/bienvenue");
    }
  }, [needsOnboarding, pathname, router, status, user]);

  if (status === "authenticated" && user && profileStatus === "checking") {
    return (
      <AuthScreen role="status">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        <h1 className="text-xl font-semibold">Chargement de ton profil professionnel…</h1>
        <p className="text-sm text-muted">IACourtier vérifie les informations enregistrées dans Supabase.</p>
      </AuthScreen>
    );
  }

  if (status === "authenticated" && user && (!needsOnboarding || pathname === "/tableau-de-bord/bienvenue")) {
    return <>{children}</>;
  }

  if (status === "authenticated" && user && needsOnboarding) {
    return (
      <AuthScreen role="status">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        <h1 className="text-xl font-semibold">Préparation de ton profil courtier…</h1>
        <p className="text-sm text-muted">La première étape est de configurer ton identité professionnelle.</p>
      </AuthScreen>
    );
  }

  if (status === "checking") {
    return (
      <AuthScreen role="status">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        <h1 className="text-xl font-semibold">Vérification de ta session…</h1>
        <p className="text-sm text-muted">IACourtier confirme ton compte Supabase avant d’ouvrir l’espace privé.</p>
      </AuthScreen>
    );
  }

  if (status === "error") {
    return (
      <AuthScreen role="alert">
        <h1 className="text-xl font-semibold">Impossible de confirmer ta session</h1>
        <p className="text-sm text-muted">L’espace privé reste fermé tant que Supabase n’a pas confirmé ton identité.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => void verifySession(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 font-semibold text-white">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
          <Link href={next} className="inline-flex min-h-11 items-center rounded-xl border border-subtle px-4 font-semibold">Se connecter</Link>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen role="alert">
      <h1 className="text-xl font-semibold">Aucune session active</h1>
      <p className="text-sm text-muted">Connecte-toi avec un vrai compte Supabase ou crée ton compte pour continuer.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={next} className="inline-flex min-h-11 items-center rounded-xl bg-teal-700 px-4 font-semibold text-white">Se reconnecter</Link>
        <Link href="/inscription" className="inline-flex min-h-11 items-center rounded-xl border border-subtle px-4 font-semibold">Créer mon compte</Link>
      </div>
    </AuthScreen>
  );
}

function AuthScreen({ children, role }: { children: ReactNode; role: "status" | "alert" }) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-soft p-6" role={role}>
      <section className="flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-subtle bg-surface p-8 text-center shadow-card">
        {children}
      </section>
    </main>
  );
}

export function SessionStatusNotice() {
  const pathname = usePathname();
  const { status, verifySession } = useDashboardAuth();

  if (status === "authenticated") return null;

  if (status === "checking") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        Vérification de ta session…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100" role="alert">
        <span>Impossible de vérifier ta session pour le moment. Tu n’as pas été déconnecté.</span>
        <button type="button" onClick={() => void verifySession(true)} className="inline-flex items-center gap-2 font-semibold underline">
          <RefreshCw className="h-4 w-4" /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100" role="alert">
      <span>Ta session est réellement terminée.</span>
      <Link href={`/connexion?next=${encodeURIComponent(pathname)}`} className="rounded-lg bg-amber-900 px-4 py-2 font-semibold text-white">
        Se reconnecter
      </Link>
    </div>
  );
}
