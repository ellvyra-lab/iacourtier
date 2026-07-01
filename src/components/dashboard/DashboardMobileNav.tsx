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
  Trophy,
  Phone,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/tableau-de-bord", label: "Ma journée", icon: LayoutDashboard },
  { href: "/tableau-de-bord/radar-prospection", label: "Prospecter", icon: Radar },
  { href: "/tableau-de-bord/prospects", label: "Suivis", icon: UserRound },
  { href: "/tableau-de-bord/coach/appels", label: "Appels", icon: Phone },
  { href: "/tableau-de-bord/actions/prepare-market-analysis", label: "Rendez-vous", icon: CalendarCheck },
  { href: "/tableau-de-bord/mandats", label: "Propriétés", icon: FolderKanban },
  { href: "/tableau-de-bord/actions/generate-marketing-launch", label: "Marché", icon: Megaphone },
  { href: "/tableau-de-bord/pipeline", label: "Clients", icon: Workflow },
  { href: "/tableau-de-bord/coach", label: "Coach", icon: Trophy },
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
