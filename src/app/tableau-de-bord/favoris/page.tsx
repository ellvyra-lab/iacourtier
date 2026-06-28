import { Heart } from "lucide-react";
import { prompts } from "@/data/prompts";

const favoriteIds = ["p1", "p3", "p5"];

export default function DashboardFavorisPage() {
  const favorites = prompts.filter((p) => favoriteIds.includes(p.id));

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Vos prompts, formations et ressources favoris, regroupés au même
        endroit.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {favorites.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface-soft p-6"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-electric-500">
                {p.category}
              </span>
              <Heart size={16} fill="currentColor" className="text-electric-500" />
            </div>
            <p className="font-semibold">{p.title}</p>
            <p className="rounded-xl bg-surface p-4 text-sm text-muted">
              {p.prompt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
