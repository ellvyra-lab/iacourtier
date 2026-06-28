"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import { blogPosts } from "@/data/blog";
import { cn } from "@/lib/utils";

const categories = ["Tous", "IA pratique", "Prospection", "Marketing", "Outils"];

export function BlogList() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tous");

  const filtered = useMemo(() => {
    return blogPosts.filter((p) => {
      const matchesCategory = category === "Tous" || p.category === category;
      const matchesQuery =
        query.trim() === "" ||
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.excerpt.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un article..."
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

      <div className="grid gap-6 sm:grid-cols-2">
        {filtered.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-7 transition-all hover:-translate-y-1 hover:border-electric-500/40 hover:shadow-glow"
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-medium uppercase tracking-wider text-electric-500">
                {post.category}
              </span>
              <span>{post.readTime} de lecture</span>
            </div>
            <p className="text-lg font-semibold leading-snug">{post.title}</p>
            <p className="text-sm text-muted">{post.excerpt}</p>
            <span className="mt-auto flex items-center gap-1 text-sm font-medium text-electric-500 opacity-0 transition-opacity group-hover:opacity-100">
              Lire l&apos;article <ArrowUpRight size={14} />
            </span>
          </Link>
        ))}

        {filtered.length === 0 && (
          <p className="col-span-2 rounded-2xl border border-dashed border-subtle p-10 text-center text-sm text-muted">
            Aucun article ne correspond à votre recherche.
          </p>
        )}
      </div>
    </div>
  );
}
