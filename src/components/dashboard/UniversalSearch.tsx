"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

type Result = { id: string; name: string; email?: string; phone?: string; cases: Array<{ id: string; type: "seller" | "buyer"; property?: { address?: string } | Array<{ address?: string }> }> };

export function UniversalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/clients?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as { clients?: Result[] };
        if (response.ok) setResults((payload.clients || []).slice(0, 6));
      } finally { setLoading(false); }
    }, 220);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query]);

  return <div className="relative hidden w-full max-w-xl md:block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un client, une adresse ou un dossier" className="min-h-10 w-full rounded-xl border border-subtle bg-surface-soft pl-10 pr-10 text-sm" />{loading ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-700" /> : null}
    {query.trim().length >= 2 ? <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-subtle bg-surface p-2 shadow-2xl">{results.length ? results.map((result) => <SearchResult key={result.id} result={result} onSelect={() => setQuery("")} />) : !loading ? <p className="p-3 text-sm text-muted">Aucun client, téléphone, courriel, adresse ou dossier trouvé.</p> : null}<Link href={`/tableau-de-bord/clients?q=${encodeURIComponent(query.trim())}`} className="block border-t border-subtle px-3 py-3 text-sm font-semibold text-teal-700">Voir tous les résultats</Link></div> : null}
  </div>;
}

function SearchResult({ result, onSelect }: { result: Result; onSelect: () => void }) {
  const first = result.cases[0];
  const property = first && (Array.isArray(first.property) ? first.property[0] : first.property);
  const href = first ? first.type === "seller" ? `/tableau-de-bord/inscriptions/${first.id}` : `/tableau-de-bord/acheteurs/${first.id}` : "/tableau-de-bord/clients";
  return <Link href={href} onClick={onSelect} className="block rounded-xl px-3 py-3 hover:bg-surface-soft"><p className="text-sm font-semibold">{result.name}</p><p className="mt-1 text-xs text-muted">{property?.address || result.email || result.phone || "Fiche client"}</p></Link>;
}
