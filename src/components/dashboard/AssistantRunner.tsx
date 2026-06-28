"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import type { AssistantConfig } from "@/data/assistantsConfig";
import { Button } from "@/components/ui/Button";

type Status = "idle" | "loading" | "success" | "error";

export function AssistantRunner({ assistant }: { assistant: AssistantConfig }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function updateField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function runGeneration() {
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: assistant.slug, values }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus("error");
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      setOutput(data.output);
      setStatus("success");
    } catch {
      setStatus("error");
      setError(
        "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez."
      );
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runGeneration();
  }

  async function handleCopy() {
    await navigator.clipboard?.writeText(output).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const isLoading = status === "loading";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- Form ---- */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-6"
      >
        {assistant.fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-electric-500"> *</span>}
            </label>

            {field.type === "textarea" && (
              <textarea
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.name] || ""}
                onChange={(e) => updateField(field.name, e.target.value)}
                rows={4}
                className="rounded-xl border border-subtle bg-surface px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
              />
            )}

            {field.type === "text" && (
              <input
                type="text"
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.name] || ""}
                onChange={(e) => updateField(field.name, e.target.value)}
                className="rounded-xl border border-subtle bg-surface px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
              />
            )}

            {field.type === "select" && (
              <select
                required={field.required}
                value={values[field.name] || ""}
                onChange={(e) => updateField(field.name, e.target.value)}
                className="rounded-xl border border-subtle bg-surface px-4 py-3 text-sm outline-none focus-visible:border-electric-500"
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

        <Button type="submit" size="lg" className="mt-2 w-full justify-center">
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Générer
            </>
          )}
        </Button>
      </form>

      {/* ---- Result ---- */}
      <div className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface p-6">
        <p className="text-sm font-semibold text-muted">Résultat</p>

        {status === "idle" && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-subtle p-10 text-center">
            <p className="text-sm text-muted">
              Remplissez le formulaire et cliquez sur « Générer » pour voir le
              résultat apparaître ici.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-subtle bg-surface-soft p-10 text-center">
            <Loader2 size={22} className="animate-spin text-electric-500" />
            <p className="text-sm text-muted">
              L&apos;assistant rédige votre résultat...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-8 text-center">
            <AlertTriangle size={22} className="text-amber-500" />
            <p className="text-sm text-amber-800">{error}</p>
            <Button variant="secondary" size="sm" onClick={runGeneration}>
              <RotateCcw size={14} />
              Réessayer
            </Button>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="flex-1 whitespace-pre-wrap rounded-xl border border-subtle bg-surface-soft p-4 text-sm leading-relaxed">
              {output}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copié" : "Copier"}
              </Button>
              <Button variant="secondary" size="sm" onClick={runGeneration}>
                <RotateCcw size={14} />
                Régénérer
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
