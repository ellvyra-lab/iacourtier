"use client";

import { useState } from "react";
import { Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const initialAutomations = [
  { id: "a1", name: "Relance client CRM", description: "Envoie un suivi automatique 3 jours après une visite sans réponse.", active: true },
  { id: "a2", name: "Publication réseaux sociaux", description: "Publie le contenu planifié chaque mardi et jeudi.", active: true },
  { id: "a3", name: "Score de prospects", description: "Met à jour le classement de vos prospects chaque nuit.", active: true },
  { id: "a4", name: "Rapport hebdomadaire", description: "Envoie un résumé de votre activité chaque lundi matin.", active: false },
  { id: "a5", name: "Alerte nouvelle inscription", description: "Vous notifie dès qu'une propriété correspond à vos critères.", active: false },
];

export default function DashboardAutomatisationsPage() {
  const [automations, setAutomations] = useState(initialAutomations);

  function toggle(id: string) {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {automations.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-4 rounded-2xl border border-subtle bg-surface-soft p-5"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
              <Workflow size={16} />
            </span>
            <div>
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted">{a.description}</p>
            </div>
          </div>

          <button
            role="switch"
            aria-checked={a.active}
            onClick={() => toggle(a.id)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              a.active ? "bg-electric-500" : "bg-[var(--border)]"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                a.active ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
