import Link from "next/link";
import {
  GraduationCap,
  Library,
  Bot,
  Workflow,
  ArrowUpRight,
} from "lucide-react";
import { formations } from "@/data/formations";

const stats = [
  { icon: GraduationCap, label: "Formations complétées", value: "4 / 8" },
  { icon: Library, label: "Prompts utilisés ce mois-ci", value: "37" },
  { icon: Bot, label: "Assistants actifs", value: "3" },
  { icon: Workflow, label: "Automatisations actives", value: "6" },
];

const inProgress = formations.slice(0, 3).map((f, i) => ({
  ...f,
  progress: [80, 45, 15][i],
}));

export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-subtle bg-surface-soft p-5"
          >
            <s.icon size={18} className="text-electric-500" />
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {s.value}
            </p>
            <p className="mt-1 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-semibold">Vos formations en cours</p>
          <Link
            href="/tableau-de-bord/formations"
            className="flex items-center gap-1 text-sm text-electric-500 hover:underline"
          >
            Tout voir <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="flex flex-col gap-5">
          {inProgress.map((f) => (
            <div key={f.slug}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{f.title}</span>
                <span className="text-muted">{f.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-electric-500 to-cyan-500"
                  style={{ width: `${f.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-subtle bg-surface-soft p-6">
          <p className="mb-4 font-semibold">Activité récente</p>
          <ul className="flex flex-col gap-3 text-sm text-muted">
            <li>Vous avez copié le prompt &laquo; Description Centris percutante &raquo;</li>
            <li>Vous avez complété le module 3 de &laquo; ChatGPT immobilier &raquo;</li>
            <li>Vous avez activé l&apos;automatisation &laquo; Relance client CRM &raquo;</li>
            <li>Vous avez téléchargé le gabarit &laquo; Calendrier de contenu 30 jours &raquo;</li>
          </ul>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-gradient-to-br from-electric-500/10 to-cyan-500/10 p-6">
          <p className="font-semibold">Prochaine étape suggérée</p>
          <p className="text-sm text-muted">
            Vous avez complété 80% de la formation &laquo; ChatGPT
            immobilier &raquo;. Terminez les deux derniers modules pour
            débloquer votre certificat.
          </p>
          <Link
            href="/tableau-de-bord/formations"
            className="w-fit rounded-full bg-gradient-to-r from-electric-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white"
          >
            Continuer la formation
          </Link>
        </div>
      </div>
    </div>
  );
}
