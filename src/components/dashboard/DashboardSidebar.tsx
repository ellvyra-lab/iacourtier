"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Home,
  ListTodo,
  Megaphone,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { LogoutButton } from "./LogoutButton";

type NavItem = { href?: string; label: string; icon: LucideIcon; disabled?: boolean };
type NavSection = { label: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: "Mon travail",
    items: [
      { href: "/tableau-de-bord/actions", label: "Ma journée", icon: CalendarDays },
      { href: "/tableau-de-bord/pipeline", label: "Pipeline", icon: BarChart3 },
      { href: "/tableau-de-bord/clients?vue=transaction", label: "Transactions", icon: BriefcaseBusiness },
      { href: "/tableau-de-bord/actions", label: "Tâches", icon: ListTodo },
      { href: "/tableau-de-bord/actions/prepare-market-analysis", label: "Calendrier", icon: CalendarDays },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/tableau-de-bord/clients", label: "Clients", icon: UsersRound },
      { href: "/tableau-de-bord/mandats", label: "Propriétés", icon: Building2 },
      { href: "/tableau-de-bord/telechargements", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "Développement",
    items: [
      { href: "/tableau-de-bord/radar-prospection", label: "Radar prospection", icon: Radar },
      { label: "Référencement", icon: UsersRound, disabled: true },
      { href: "/tableau-de-bord/automatisations", label: "Automatisations", icon: Workflow },
    ],
  },
  {
    label: "Outils IA",
    items: [
      { href: "/tableau-de-bord/actions/prepare-market-analysis", label: "Évaluation IA", icon: Sparkles },
      { href: "/tableau-de-bord/clients?vue=seller", label: "Préparation Centris", icon: ClipboardCheck },
      { href: "/tableau-de-bord/actions/generate-marketing-launch", label: "Marketing IA", icon: Megaphone },
      { href: "/tableau-de-bord/historique", label: "Rapports clients", icon: FileText },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useDashboardAuth();
  const isSuperAdmin = user?.app_metadata?.role === "super_admin";
  return <aside className="hidden w-72 shrink-0 flex-col border-r border-subtle bg-surface-soft lg:flex">
    <div className="flex h-18 items-center gap-2 border-b border-subtle px-6"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-electric-500 to-cyan-500 text-white"><Sparkles size={16} /></span><span className="font-semibold tracking-tight">IA<span className="text-gradient">Courtier</span></span></div>
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      <NavLink href="/tableau-de-bord" label="Accueil" icon={Home} active={pathname === "/tableau-de-bord"} />
      {sections.map((section) => <div key={section.label} className="mt-6"><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted">{section.label}</p><div className="space-y-1">{section.items.map((item) => item.disabled ? <div key={item.label} title="Bientôt disponible" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted opacity-60"><item.icon size={16} /><span>{item.label}</span><span className="ml-auto text-[9px] font-bold uppercase">Bientôt</span></div> : <NavLink key={item.href + item.label} href={item.href || "/tableau-de-bord"} label={item.label} icon={item.icon} active={isActive(pathname, item.href || "")} />)}</div></div>)}
      <div className="mt-6"><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted">Assistance</p><NavLink href="/tableau-de-bord/coach" label="Coach IA" icon={Bot} active={pathname.startsWith("/tableau-de-bord/coach")} /></div>
    </nav>
    <div className="space-y-1 border-t border-subtle px-3 py-4"><NavLink href="/tableau-de-bord/parametres" label="Paramètres" icon={Settings} active={pathname.startsWith("/tableau-de-bord/parametres")} />{isSuperAdmin ? <NavLink href="/admin" label="Administration" icon={ShieldCheck} active={pathname.startsWith("/admin")} /> : null}<LogoutButton /></div>
  </aside>;
}

function isActive(pathname: string, href: string) {
  const base = href.split("?")[0];
  if (href.includes("vue=transaction")) return pathname.startsWith("/tableau-de-bord/clients");
  return base !== "/tableau-de-bord" && pathname.startsWith(base);
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return <Link href={href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active ? "bg-electric-500/10 font-medium text-electric-500" : "text-muted hover:bg-[var(--bg)] hover:text-[var(--fg)]")}><Icon size={16} />{label}</Link>;
}
