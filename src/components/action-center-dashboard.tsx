"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSearch,
  FileText,
  Flag,
  FolderInput,
  Home,
  Mail,
  Megaphone,
  Phone,
  Plus,
  Radar,
  Upload,
  Video,
} from "lucide-react";

import type { ActionCenterData, ActionItem, ActionPriority } from "@/lib/action-center";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const recentActivity = [
  "Description générée",
  "Analyse terminée",
  "Prospect importé",
  "Document analysé",
  "Nouveau mandat",
];

export function ActionCenterDashboard({ data }: { data: ActionCenterData }) {
  const topActions = data.todayActions.slice(0, 5);
  const [brokerName, setBrokerName] = useState("courtier");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: authData }) => {
      const user = authData.user;
      const name = (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "courtier";
      setBrokerName(name);
    });
  }, []);

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px] lg:p-7">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Mode Bêta</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Bonjour {brokerName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Voici votre centre de travail pour aujourd&apos;hui. IACourtier priorise les mandats, prospects, documents et contenus à produire pour tester le produit avec de vrais dossiers.
            </p>
            <StartPanel />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <HeroMetric label="Mandats actifs" value={data.summary.mandates.active.toString()} />
              <HeroMetric label="Prospects Radar" value={data.summary.radar.newProspects.toString()} />
              <HeroMetric label="Actions aujourd'hui" value={(data.todayActions.length + data.followUpActions.length).toString()} />
              <HeroMetric label="Documents en attente" value={data.summary.mandates.missingDocuments.toString()} />
              <HeroMetric label="Analyses comparatives" value={data.summary.mandates.analysesToFinish.toString()} />
              <HeroMetric label="Descriptions à générer" value={data.summary.mandates.descriptionsToGenerate.toString()} />
            </div>
            <ProgressCard />
          </div>
        </div>
      </section>

      <QuickShortcuts />

      <section className="space-y-4">
        <SectionHeading title="À faire aujourd'hui" subtitle="Les prochaines actions recommandées par le moteur IA." />
        <div className="grid gap-4 xl:grid-cols-5">
          {topActions.map((action) => (
            <ActionCard key={action.id} action={action} compact />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="space-y-6">
          <RadarSummary data={data} />
          <MandateSummary data={data} />
          <MarketingSummary data={data} />
        </section>

        <section className="space-y-6">
          <FollowUpSummary actions={data.followUpActions} />
          <RecentActivity />
          <EngineSummary />
        </section>
      </div>
    </div>
  );
}

function StartPanel() {
  const items = [
    { label: "Nouveau mandat", href: "/tableau-de-bord/mandats/nouveau", icon: Plus },
    { label: "Importer un mandat", href: "/tableau-de-bord/mandats/nouveau", icon: FolderInput },
    { label: "Importer une liste de prospects", href: "/tableau-de-bord/radar-prospection", icon: Upload },
    { label: "Ouvrir le Radar", href: "/tableau-de-bord/radar-prospection", icon: Radar },
    { label: "Générer une analyse comparative", href: "/tableau-de-bord/mandats/boucherville-familiale/analyse-comparative", icon: BarChart3 },
  ];

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Commencer</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choisissez la prochaine action à lancer.</p>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="flex min-h-24 flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium transition hover:border-teal-300 hover:bg-teal-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-800 dark:hover:bg-teal-950/20">
            <item.icon className="h-4 w-4 text-teal-600" />
            <span className="leading-snug">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProgressCard() {
  const missing = ["certificat de localisation", "compte de taxes", "analyse comparative"];

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900 dark:bg-teal-950/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">Dossier prioritaire</p>
          <p className="mt-1 text-xs text-teal-900/70 dark:text-teal-100/70">Votre dossier est complété à 70 %</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 dark:bg-slate-950 dark:text-teal-200 dark:ring-teal-900">70 %</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-900">
        <div className="h-full w-[70%] rounded-full bg-teal-600" />
      </div>
      <p className="mt-4 text-xs font-semibold text-teal-900 dark:text-teal-100">Il manque :</p>
      <ul className="mt-2 space-y-1 text-xs text-teal-900/75 dark:text-teal-100/75">
        {missing.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function QuickShortcuts() {
  const shortcuts = [
    { label: "Nouveau mandat", href: "/tableau-de-bord/mandats/nouveau", icon: Plus },
    { label: "Radar", href: "/tableau-de-bord/radar-prospection", icon: Radar },
    { label: "Lancer mise en marché", href: "/tableau-de-bord/actions/generate-marketing-launch", icon: FileText },
    { label: "Analyse comparative", href: "/tableau-de-bord/mandats/boucherville-familiale/analyse-comparative", icon: BarChart3 },
    { label: "Documents", href: "/tableau-de-bord/mandats/nouveau", icon: FileSearch },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <h2 className="text-xl font-semibold tracking-tight">Raccourcis rapides</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Accès direct aux flux les plus utilisés pendant la Bêta.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {shortcuts.map((shortcut) => (
          <Link key={shortcut.label} href={shortcut.href} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold transition hover:border-teal-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-teal-800 dark:hover:bg-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-teal-700 dark:bg-slate-900 dark:text-teal-300">
              <shortcut.icon className="h-4 w-4" />
            </span>
            {shortcut.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

function ActionCard({ action, compact = false }: { action: ActionItem; compact?: boolean }) {
  return (
    <article className="flex min-h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex items-start justify-between gap-3">
        <ActionIcon action={action} />
        <PriorityBadge priority={action.priority} />
      </div>
      <h3 className="mt-4 text-base font-semibold leading-snug tracking-tight">{action.title}</h3>
      <p className={cn("mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300", compact ? "line-clamp-4" : "")}>{action.description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatDueDate(action.dueAt)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
          <Clock3 className="h-3.5 w-3.5" />
          {action.estimatedMinutes} min
        </span>
      </div>
      <Link href={action.href} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
        Commencer
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function RadarSummary({ data }: { data: ActionCenterData }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
            <Radar className="h-4 w-4" />
            Radar
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Prospection priorisée</h2>
        </div>
        <Link href="/tableau-de-bord/radar-prospection" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-950">
          Voir
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Nouveaux prospects" value={data.summary.radar.newProspects.toString()} />
        <SummaryTile label="Score moyen" value={`${data.summary.radar.averageScore}/100`} />
        <SummaryTile label="Priorité élevée" value={data.summary.radar.highPriority.toString()} />
      </div>
    </section>
  );
}

function MandateSummary({ data }: { data: ActionCenterData }) {
  const items = [
    ["Mandats actifs", data.summary.mandates.active],
    ["Mandats incomplets", data.summary.mandates.incomplete],
    ["Documents manquants", data.summary.mandates.missingDocuments],
    ["Descriptions à générer", data.summary.mandates.descriptionsToGenerate],
    ["Analyses à terminer", data.summary.mandates.analysesToFinish],
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
        <Home className="h-4 w-4" />
        Mandats
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">Dossiers à faire avancer</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(([label, value]) => (
          <SummaryTile key={label} label={String(label)} value={String(value)} />
        ))}
      </div>
    </section>
  );
}

function FollowUpSummary({ actions }: { actions: ActionItem[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
        <Phone className="h-4 w-4" />
        Suivis
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">Relances dues</h2>
      <div className="mt-5 space-y-3">
        {actions.length ? actions.map((action) => <ActionCard key={action.id} action={action} />) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucune relance due aujourd&apos;hui.</p>}
      </div>
    </section>
  );
}

function MarketingSummary({ data }: { data: ActionCenterData }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
        <Megaphone className="h-4 w-4" />
        Marketing
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">Contenu à produire</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryTile icon={Mail} label="Publications à faire" value={data.summary.marketing.posts.toString()} />
        <SummaryTile icon={Video} label="Vidéos" value={data.summary.marketing.videos.toString()} />
        <SummaryTile icon={CheckCircle2} label="Témoignages" value={data.summary.marketing.testimonials.toString()} />
      </div>
    </section>
  );
}

function RecentActivity() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Dernière activité</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">Activité récente</h2>
      <div className="mt-4 space-y-3">
        {recentActivity.map((activity) => (
          <div key={activity} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
            {activity}
          </div>
        ))}
      </div>
    </section>
  );
}

function EngineSummary() {
  return (
    <section className="rounded-lg border border-teal-200 bg-teal-50/60 p-5 dark:border-teal-900 dark:bg-teal-950/24">
      <p className="flex items-center gap-2 text-sm font-semibold text-teal-800 dark:text-teal-100">
        <Flag className="h-4 w-4" />
        Moteur d&apos;actions
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-teal-950 dark:text-teal-50">Une action, une prochaine étape</h2>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-teal-900/80 dark:text-teal-100/80">
        <li>Analyse comparative terminée : envoyer l&apos;analyse au vendeur.</li>
        <li>Description générée : publier le nouveau mandat.</li>
        <li>Radar : créer le premier appel.</li>
        <li>CSV importé : créer le premier courriel.</li>
      </ul>
      <p className="mt-4 text-xs leading-5 text-teal-900/70 dark:text-teal-100/70">
        Les actions sont dédupliquées par clé métier et prévues pour être synchronisées plus tard avec Outlook, Google Calendar et un CRM.
      </p>
    </section>
  );
}

function SummaryTile({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Mail }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      {Icon ? <Icon className="mb-3 h-4 w-4 text-teal-600" /> : null}
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: ActionPriority }) {
  const className =
    priority === "Élevée"
      ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900"
      : priority === "Moyenne"
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900"
        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";

  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", className)}>{priority}</span>;
}

function ActionIcon({ action }: { action: ActionItem }) {
  const Icon = action.source === "radar" || action.source === "csv" ? Radar : action.source === "document" ? FileText : action.source === "marketing" ? Megaphone : action.source === "suivi" ? Phone : BarChart3;
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-teal-700 dark:bg-slate-800 dark:text-teal-300">
      <Icon className="h-5 w-5" />
    </span>
  );
}

function formatDueDate(value: string) {
  if (value === "2026-06-30") return "Aujourd'hui";
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}
