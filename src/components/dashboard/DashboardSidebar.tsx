"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, CalendarDays, FileText, LayoutDashboard, Megaphone, Radar, Settings, ShieldCheck, Sparkles, UsersRound, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { LogoutButton } from "./LogoutButton";

const main = [
  { href: "/tableau-de-bord", label: "Accueil", icon: LayoutDashboard },
  { href: "/tableau-de-bord/clients", label: "Clients & dossiers", icon: UsersRound },
  { href: "/tableau-de-bord/radar-prospection", label: "Prospection", icon: Radar },
  { href: "/tableau-de-bord/actions/prepare-market-analysis", label: "Calendrier", icon: CalendarDays },
  { href: "/tableau-de-bord/coach", label: "Coach IA", icon: Bot },
];
const tools = [
  { href: "/tableau-de-bord/actions/generate-marketing-launch", label: "Marketing", icon: Megaphone },
  { href: "/tableau-de-bord/automatisations", label: "Automatisations", icon: Workflow },
  { href: "/tableau-de-bord/telechargements", label: "Documents", icon: FileText },
  { href: "/tableau-de-bord/historique", label: "Rapports", icon: BarChart3 },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useDashboardAuth();
  const isSuperAdmin = user?.app_metadata?.role === "super_admin";
  return <aside className="hidden w-64 shrink-0 flex-col border-r border-subtle bg-surface-soft lg:flex">
    <div className="flex h-18 items-center gap-2 border-b border-subtle px-6"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-electric-500 to-cyan-500 text-white"><Sparkles size={16} /></span><span className="font-semibold tracking-tight">IA<span className="text-gradient">Courtier</span></span></div>
    <nav className="flex-1 overflow-y-auto px-3 py-5"><NavGroup items={main} pathname={pathname} /><p className="mb-2 mt-7 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted">Outils</p><NavGroup items={tools} pathname={pathname} /></nav>
    <div className="space-y-1 border-t border-subtle px-3 py-4"><NavLink href="/tableau-de-bord/parametres" label="Paramètres" icon={Settings} active={pathname.startsWith("/tableau-de-bord/parametres")} />{isSuperAdmin ? <NavLink href="/admin" label="Administration" icon={ShieldCheck} active={pathname.startsWith("/admin")} /> : null}<LogoutButton /></div>
  </aside>;
}

function NavGroup({ items, pathname }: { items: typeof main; pathname: string }) { return <div className="space-y-1">{items.map((item) => <NavLink key={item.href} {...item} active={item.href === "/tableau-de-bord" ? pathname === item.href : pathname.startsWith(item.href)} />)}</div>; }
function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutDashboard; active: boolean }) { return <Link href={href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active ? "bg-electric-500/10 font-medium text-electric-500" : "text-muted hover:bg-[var(--bg)] hover:text-[var(--fg)]")}><Icon size={16} />{label}</Link>; }

