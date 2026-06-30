"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const titles: Record<string, string> = {
  "/tableau-de-bord": "Accueil",
  "/tableau-de-bord/formations": "Formations",
  "/tableau-de-bord/prompts": "Recherche de prompts",
  "/tableau-de-bord/favoris": "Favoris",
  "/tableau-de-bord/historique": "Historique",
  "/tableau-de-bord/radar-prospection": "Radar de prospection",
  "/tableau-de-bord/telechargements": "Téléchargements",
  "/tableau-de-bord/assistants": "Assistants IA",
  "/tableau-de-bord/automatisations": "Automatisations",
  "/tableau-de-bord/abonnement": "Abonnement",
  "/tableau-de-bord/parametres": "Paramètres",
  "/tableau-de-bord/support": "Support",
};

export function DashboardTopbar() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Tableau de bord";
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
        <span
          title={label}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-electric-400 to-cyan-400 text-sm font-semibold text-white"
        >
          {initial || ""}
        </span>
      </div>
    </header>
  );
}
