"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Loader2, Sparkles } from "lucide-react";

import type { ContextualAiAction } from "@/lib/ai-actions";

type RunResponse = {
  ok: boolean;
  error?: string;
  results?: Array<{ slug: string; label: string; output: string }>;
};

export function BusinessActionRunner({
  action,
  searchParams,
}: {
  action: ContextualAiAction;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [results, setResults] = useState<Array<{ slug: string; label: string; output: string }>>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const context = useMemo(() => normalizeSearchParams(searchParams), [searchParams]);
  const hasContext = Object.values(context).some((value) => value.trim());

  async function runAction() {
    setStatus("loading");
    setError("");
    setCopied("");

    try {
      const response = await fetch("/api/business-actions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: action.id, context }),
      });
      const payload = (await response.json()) as RunResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "L'action n'a pas pu être exécutée.");
      setResults(payload.results ?? []);
      setStatus("success");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "L'action n'a pas pu être exécutée.");
      setStatus("error");
    }
  }

  async function copyOutput(label: string, output: string) {
    await navigator.clipboard.writeText(output);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1400);
  }

  return (
    <div className="space-y-6">
      <Link href="/tableau-de-bord/actions" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Retour aux missions
      </Link>

      <section className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <p className="text-sm font-semibold text-electric-500">Mission de travail</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{action.label}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{action.description}</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-subtle bg-background/80 p-4">
            <p className="text-sm font-semibold">Ce que je vais préparer</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {action.outputs.map((output) => (
                <span key={output} className="rounded-full border border-subtle px-3 py-1 text-xs text-muted">
                  {output}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-background/80 p-4">
            <p className="text-sm font-semibold">Travail en arrière-plan</p>
            <div className="mt-3 space-y-2">
              {(action.serviceLabels ?? [action.assistantSlug ?? "Service IA"]).map((service) => (
                <div key={service} className="flex items-center gap-2 text-sm text-muted">
                  <Sparkles className="h-3.5 w-3.5 text-electric-500" />
                  {service}
                </div>
              ))}
            </div>
          </div>
        </div>

        {hasContext ? (
          <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
            Cette action utilise automatiquement le contexte du dossier sélectionné. Aucun assistant à choisir, aucune information à retaper.
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Aucun dossier n&apos;est sélectionné. Lancez cette action depuis un prospect, un mandat ou une propriété pour une génération complète.
          </div>
        )}

        <button
          type="button"
          onClick={runAction}
          disabled={status === "loading"}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {status === "loading" ? "Je prépare la mission..." : "Commencer cette mission"}
        </button>
      </section>

      {status === "error" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : null}

      {results.length ? (
        <section className="space-y-4">
          {results.map((result) => (
            <article key={result.slug} className="rounded-2xl border border-subtle bg-surface p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Résultat</p>
                  <h2 className="mt-1 text-lg font-semibold">{result.label}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => copyOutput(result.label, result.output)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-subtle px-3 py-2 text-sm font-semibold text-muted hover:text-foreground"
                >
                  {copied === result.label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === result.label ? "Copié" : "Copier"}
                </button>
              </div>
              <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-subtle bg-surface-soft p-4 text-sm leading-7">{result.output}</div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function normalizeSearchParams(params?: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(params ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] || "" : value || ""]),
  );
}
