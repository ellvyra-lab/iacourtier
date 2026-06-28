import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { formations } from "@/data/formations";

const progressMap: Record<string, number> = {
  "ia-pour-debutants": 100,
  "chatgpt-immobilier": 80,
  "creer-des-publications": 45,
  "automatiser-hubspot": 0,
  "creer-des-videos": 15,
  "descriptions-centris": 100,
  "prospection-ia": 0,
  "agent-ia": 0,
};

export default function DashboardFormationsPage() {
  return (
    <div className="flex flex-col gap-4">
      {formations.map((f) => {
        const progress = progressMap[f.slug] ?? 0;
        const done = progress === 100;
        return (
          <div
            key={f.slug}
            className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              {done ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-cyan-500" />
              ) : progress > 0 ? (
                <PlayCircle size={18} className="mt-0.5 shrink-0 text-electric-500" />
              ) : (
                <Circle size={18} className="mt-0.5 shrink-0 text-muted" />
              )}
              <div>
                <p className="font-medium">{f.title}</p>
                <p className="text-sm text-muted">{f.modules} modules · {f.duration}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:w-64">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-electric-500 to-cyan-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm text-muted">{progress}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
