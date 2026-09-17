"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ListTodo, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/tableau-de-bord", label: "Aujourd’hui", icon: CalendarDays },
  { href: "/tableau-de-bord/actions", label: "Tâches", icon: ListTodo },
  { href: "/tableau-de-bord/pipeline", label: "Pipeline", icon: BarChart3 },
  { href: "/tableau-de-bord/clients", label: "Clients", icon: UsersRound },
];

export function DashboardMobileNav() {
  const pathname = usePathname();
  return <nav className="grid grid-cols-4 border-b border-subtle bg-surface-soft px-1 py-2 lg:hidden">{items.map((item) => { const active = item.href === "/tableau-de-bord" ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold", active ? "bg-electric-500/10 text-electric-500" : "text-muted")}><item.icon size={18} /><span className="truncate">{item.label}</span></Link>; })}</nav>;
}
