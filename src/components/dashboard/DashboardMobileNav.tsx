"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Radar,
  GraduationCap,
  Search,
  Heart,
  Bot,
  Workflow,
  Trophy,
  Phone,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/tableau-de-bord", label: "Accueil", icon: LayoutDashboard },
  { href: "/tableau-de-bord/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/tableau-de-bord/coach", label: "Coach IA", icon: Trophy },
  { href: "/tableau-de-bord/coach/appels", label: "Appels", icon: Phone },
  { href: "/tableau-de-bord/prospects", label: "Prospects", icon: UserRound },
  { href: "/tableau-de-bord/mandats", label: "Mandats", icon: FolderKanban },
  { href: "/tableau-de-bord/radar-prospection", label: "Radar", icon: Radar },
  { href: "/tableau-de-bord/formations", label: "Formations", icon: GraduationCap },
  { href: "/tableau-de-bord/prompts", label: "Prompts", icon: Search },
  { href: "/tableau-de-bord/favoris", label: "Favoris", icon: Heart },
  { href: "/tableau-de-bord/assistants", label: "Assistants IA", icon: Bot },
  { href: "/tableau-de-bord/automatisations", label: "Automatisations", icon: Workflow },
];

// Horizontal scrollable nav shown only below the desktop sidebar breakpoint.
export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-subtle bg-surface-soft px-4 py-3 lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium",
              active
                ? "border-electric-500 bg-electric-500/10 text-electric-500"
                : "border-subtle text-muted"
            )}
          >
            <item.icon size={14} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
