"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CalendarDays, LayoutDashboard, Radar, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/tableau-de-bord", label: "Accueil", icon: LayoutDashboard },
  { href: "/tableau-de-bord/clients", label: "Dossiers", icon: UsersRound },
  { href: "/tableau-de-bord/radar-prospection", label: "Prospecter", icon: Radar },
  { href: "/tableau-de-bord/actions/prepare-market-analysis", label: "Calendrier", icon: CalendarDays },
  { href: "/tableau-de-bord/coach", label: "Coach", icon: Bot },
];

export function DashboardMobileNav() {
  const pathname = usePathname();
  return <nav className="grid grid-cols-5 border-b border-subtle bg-surface-soft px-1 py-2 lg:hidden">{items.map((item) => { const active = item.href === "/tableau-de-bord" ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold", active ? "bg-electric-500/10 text-electric-500" : "text-muted")}><item.icon size={17} /><span className="truncate">{item.label}</span></Link>; })}</nav>;
}
