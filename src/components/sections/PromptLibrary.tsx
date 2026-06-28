"use client";

import { useMemo, useState } from "react";
import { Search, Copy, Check } from "lucide-react";
import { prompts, categories } from "@/data/prompts";
import { cn } from "@/lib/utils";

export function PromptLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Tous");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      const matchesCategory = category === "Tous" || p.category === category;
      const matchesQuery =
        query.trim() === "" ||
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.prompt.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  function handleCopy(id: string, text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un prompt..."
            className="w-full rounded-full border border-subtle bg-surface-soft py-3 pl-11 pr-4 text-sm outline-none focus-visible:border-electric-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                category === cat
                  ? "border-electric-500 bg-electric-500/10 text-electric-500"
                  : "border-subtle text-muted hover:border-electric-500/40"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted">
        {filtered.length} prompt{filtered.length > 1 ? "s" : ""} trouvé
        {filtered.length > 1 ? "s" : ""} — bibliothèque complète : 1000+
        prompts pour les membres.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-electric-500">
                  {p.category}
                </span>
                <p className="mt-1 font-semibold">{p.title}</p>
              </div>
              <button
                onClick={() => handleCopy(p.id, p.prompt)}
                aria-label="Copier le prompt"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-subtle text-muted transition-colors hover:border-electric-500 hover:text-electric-500"
              >
                {copiedId === p.id ? (
                  <Check size={14} className="text-cyan-500" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            <p className="rounded-xl bg-surface p-4 text-sm text-muted">
              {p.prompt}
            </p>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="col-span-2 rounded-2xl border border-dashed border-subtle p-10 text-center text-sm text-muted">
            Aucun prompt ne correspond à votre recherche. Essayez un autre
            mot-clé ou une autre catégorie.
          </p>
        )}
      </div>
    </div>
  );
}
