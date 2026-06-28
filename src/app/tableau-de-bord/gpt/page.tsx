import { Bot, ArrowUpRight } from "lucide-react";

const gpts = [
  { name: "GPT Description Centris", description: "Génère des fiches descriptives optimisées pour Centris.", active: true },
  { name: "GPT Script de prospection", description: "Crée des scripts d'appel adaptés à chaque type de prospect.", active: true },
  { name: "GPT Réseaux sociaux", description: "Planifie et rédige vos publications hebdomadaires.", active: true },
  { name: "GPT Négociation", description: "Aide à formuler des réponses lors de négociations.", active: false },
  { name: "GPT Service client", description: "Répond aux questions fréquentes de vos clients automatiquement.", active: false },
];

export default function DashboardGptPage() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {gpts.map((g) => (
        <div
          key={g.name}
          className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-6"
        >
          <div className="flex items-start justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
              <Bot size={20} />
            </span>
            <span
              className={
                g.active
                  ? "rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-500"
                  : "rounded-full bg-[var(--border)] px-3 py-1 text-xs font-medium text-muted"
              }
            >
              {g.active ? "Activé" : "Inactif"}
            </span>
          </div>
          <p className="font-semibold">{g.name}</p>
          <p className="text-sm text-muted">{g.description}</p>
          <button className="mt-auto flex w-fit items-center gap-1 text-sm font-medium text-electric-500 hover:underline">
            Ouvrir <ArrowUpRight size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
