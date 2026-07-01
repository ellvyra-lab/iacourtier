"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Radar,
  CalendarCheck,
  Megaphone,
  Workflow,
  Settings,
  Sparkles,
  CreditCard,
  LifeBuoy,
  Trophy,
  Phone,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./LogoutButton";

const navItems = [
  { href: "/tableau-de-bord", label: "Ma journée", icon: LayoutDashboard },
  { href: "/tableau-de-bord/radar-prospection", label: "Trouver des vendeurs", icon: Radar },
  { href: "/tableau-de-bord/prospects", label: "Faire mes suivis", icon: UserRound },
  { href: "/tableau-de-bord/coach/appels", label: "Faire mes appels", icon: Phone },
  { href: "/tableau-de-bord/actions/prepare-market-analysis", label: "Préparer un rendez-vous", icon: CalendarCheck },
  { href: "/tableau-de-bord/mandats", label: "Mes propriétés", icon: FolderKanban },
  { href: "/tableau-de-bord/actions/generate-marketing-launch", label: "Mettre en marché", icon: Megaphone },
  { href: "/tableau-de-bord/pipeline", label: "Parcours clients", icon: Workflow },
  { href: "/tableau-de-bord/coach", label: "M'entraîner", icon: Trophy },
  { href: "/tableau-de-bord/abonnement", label: "Abonnement", icon: CreditCard },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-subtle bg-surface-soft lg:flex">
      <div className="flex h-18 items-center gap-2 border-b border-subtle px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-electric-500 to-cyan-500 text-white">
          <Sparkles size={16} />
        </span>
        <span className="font-semibold tracking-tight">
          IA<span className="text-gradient">Courtier</span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-electric-500/10 font-medium text-electric-500"
                  : "text-muted hover:bg-[var(--bg)] hover:text-[var(--fg)]"
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-subtle px-3 py-4">
        <Link
          href="/tableau-de-bord/parametres"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-[var(--bg)] hover:text-[var(--fg)]"
        >
          <Settings size={16} />
          Paramètres
        </Link>
        <Link
          href="/tableau-de-bord/support"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-[var(--bg)] hover:text-[var(--fg)]"
        >
          <LifeBuoy size={16} />
          Support
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
