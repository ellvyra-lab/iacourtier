"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LayoutDashboard, Settings, Sparkles, Star, Users } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

const titles: Record<string, string> = {
  "/tableau-de-bord": "Ma journée",
  "/tableau-de-bord/pipeline": "Parcours clients",
  "/tableau-de-bord/coach": "M'entraîner",
  "/tableau-de-bord/coach/appels": "Faire mes appels",
  "/tableau-de-bord/prospects": "Faire mes suivis",
  "/tableau-de-bord/formations": "Formations",
  "/tableau-de-bord/prompts": "Recherche de prompts",
  "/tableau-de-bord/favoris": "Favoris",
  "/tableau-de-bord/historique": "Historique",
  "/tableau-de-bord/radar-prospection": "Trouver des vendeurs",
  "/tableau-de-bord/telechargements": "Téléchargements",
  "/tableau-de-bord/actions": "Missions du jour",
  "/tableau-de-bord/assistants": "Services IA internes",
  "/tableau-de-bord/automatisations": "Automatisations",
  "/tableau-de-bord/abonnement": "Abonnement",
  "/tableau-de-bord/parametres": "Paramètres",
  "/tableau-de-bord/identite-professionnelle": "Mon identité professionnelle",
  "/tableau-de-bord/support": "Support",
};

export function DashboardTopbar() {
  const pathname = usePathname();
  const title = titles[pathname] ?? titleFromPath(pathname);
  const [label, setLabel] = useState<string>("");
  const [initial, setInitial] = useState<string>("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      const name = (user.user_metadata?.full_name as string) || user.email || "";
      setLabel(name);
      setInitial(name.charAt(0).toUpperCase());
    });
  }, []);

  return (
    <header className="flex h-18 items-center justify-between border-b border-subtle bg-surface px-6 py-3">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-4">
        <button
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-subtle text-muted hover:border-electric-500 hover:text-electric-500"
        >
          <Bell size={16} />
        </button>
        <ThemeToggle />
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-transparent p-1 pr-2 transition hover:border-subtle">
            <span title={label} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-electric-400 to-cyan-400 text-sm font-semibold text-white">{initial || ""}</span>
            <ChevronDown size={14} className="text-muted transition group-open:rotate-180" />
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-subtle bg-surface p-2 shadow-xl">
            <div className="border-b border-subtle px-3 py-3"><p className="truncate text-sm font-semibold">{label || "Courtier"}</p><p className="mt-1 text-xs text-muted">Espace professionnel</p></div>
            <nav className="mt-2 space-y-1">
              <TopbarMenuLink href="/tableau-de-bord" label="Mon tableau de bord" icon={LayoutDashboard} />
              <TopbarMenuLink href="/tableau-de-bord/identite-professionnelle" label="Mon identité professionnelle" icon={Star} highlighted />
              <TopbarMenuLink href="/tableau-de-bord/identite-professionnelle#partenaires" label="Mes partenaires" icon={Users} />
              <TopbarMenuLink href="/tableau-de-bord/assistants" label="Mes modèles IA" icon={Sparkles} />
              <TopbarMenuLink href="/tableau-de-bord/parametres" label="Paramètres" icon={Settings} />
            </nav>
            <div className="mt-2 border-t border-subtle pt-2"><LogoutButton /></div>
          </div>
        </details>
      </div>
    </header>
  );
}

function titleFromPath(pathname: string) {
  if (pathname.startsWith("/tableau-de-bord/actions/prepare-market-analysis")) return "Préparer un rendez-vous";
  if (pathname.startsWith("/tableau-de-bord/actions/generate-marketing-launch")) return "Mettre une propriété en marché";
  if (pathname.startsWith("/tableau-de-bord/actions/prepare-first-seller-call")) return "Préparer un premier contact";
  if (pathname.startsWith("/tableau-de-bord/actions/generate-sold-campaign")) return "Générer la campagne vendu";
  if (pathname.startsWith("/tableau-de-bord/actions/")) return "Mission de travail";
  if (pathname.startsWith("/tableau-de-bord/mandats")) return "Mes propriétés";
  if (pathname.startsWith("/tableau-de-bord/prospects")) return "Faire mes suivis";
  return "Ma journée";
}


function TopbarMenuLink({ href, label, icon: Icon, highlighted = false }: { href: string; label: string; icon: typeof Star; highlighted?: boolean }) {
  return <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${highlighted ? "bg-electric-500/10 font-semibold text-electric-500" : "text-muted hover:bg-background hover:text-foreground"}`}><Icon size={16} />{label}</Link>;
}
