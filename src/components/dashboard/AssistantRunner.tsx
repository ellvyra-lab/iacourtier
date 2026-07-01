"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  MapPin,
} from "lucide-react";
import type { AssistantConfig } from "@/data/assistantsConfig";
import { Button } from "@/components/ui/Button";

type Status = "idle" | "loading" | "success" | "error";
type AssistantSearchParams = Record<string, string | string[] | undefined> | undefined;
type RadarProspectContext = {
  address: string;
  city: string;
  propertyType: string;
  score: string;
  reason: string;
  priority: string;
  status: string;
  source: string;
  notes: string;
  phone: string;
  email: string;
  name: string;
  channel: string;
};

export function AssistantRunner({ assistant, searchParams }: { assistant: AssistantConfig; searchParams?: AssistantSearchParams }) {
  const radarContext = useMemo(() => parseRadarContext(assistant.slug, searchParams), [assistant.slug, searchParams]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!radarContext) return;

    setValues((current) => ({
      ...current,
      canal: radarContext.channel,
      type_prospect: buildRadarProspectSummary(radarContext),
      radar_context: JSON.stringify(radarContext),
      radar_address: radarContext.address,
      radar_city: radarContext.city,
      radar_property_type: radarContext.propertyType,
      radar_priority: radarContext.priority,
      radar_score: radarContext.score,
      radar_reason: radarContext.reason,
      radar_status: radarContext.status,
      radar_source: radarContext.source,
      radar_notes: radarContext.notes,
      radar_phone: radarContext.phone,
      radar_email: radarContext.email,
      radar_name: radarContext.name,
    }));
  }, [radarContext]);

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
        {radarContext ? <RadarProspectCard context={radarContext} /> : null}

        {assistant.fields.filter((field) => !(radarContext && field.name === "type_prospect")).map((field) => (
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

function RadarProspectCard({ context }: { context: RadarProspectContext }) {
  return (
    <div className="rounded-2xl border border-electric-500/20 bg-electric-500/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-500">Prospect sélectionné</p>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{context.address || "Adresse non précisée"}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <MapPin size={15} />
            {context.city || "Ville non précisée"}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <InfoPill label="Type" value={context.propertyType || "Non précisé"} icon={Building2} />
          <InfoPill label="Priorité" value={context.priority || "À qualifier"} />
          <InfoPill label="Canal" value={context.channel || "Appel téléphonique"} />
          <InfoPill label="Prochaine action" value={nextActionForChannel(context.channel)} />
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Building2 }) {
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
        {Icon ? <Icon size={14} className="text-electric-500" /> : null}
        {value}
      </p>
    </div>
  );
}

function parseRadarContext(slug: string, searchParams: AssistantSearchParams): RadarProspectContext | null {
  if (slug !== "message-prospection" || readParam(searchParams, "context") !== "radar") return null;

  return {
    address: readParam(searchParams, "address"),
    city: readParam(searchParams, "city"),
    propertyType: readParam(searchParams, "propertyType"),
    score: readParam(searchParams, "score"),
    reason: readParam(searchParams, "reason"),
    priority: readParam(searchParams, "priority"),
    status: readParam(searchParams, "status"),
    source: readParam(searchParams, "source"),
    notes: readParam(searchParams, "notes"),
    phone: readParam(searchParams, "phone"),
    email: readParam(searchParams, "email"),
    name: readParam(searchParams, "name"),
    channel: readParam(searchParams, "channel") || "Appel téléphonique",
  };
}

function readParam(searchParams: AssistantSearchParams, key: string) {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function buildRadarProspectSummary(context: RadarProspectContext) {
  return [
    context.name ? `Nom/contact : ${context.name}` : "",
    context.address ? `Adresse : ${context.address}` : "",
    context.city ? `Ville : ${context.city}` : "",
    context.propertyType ? `Type de propriété : ${context.propertyType}` : "",
    context.priority ? `Priorité interne : ${context.priority}` : "",
    context.reason ? `Contexte interne : ${context.reason}` : "",
    context.notes ? `Notes : ${context.notes}` : "",
    context.phone ? `Téléphone : ${context.phone}` : "",
    context.email ? `Courriel : ${context.email}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function nextActionForChannel(channel: string) {
  if (channel.toLowerCase().includes("texto")) return "Envoyer un message court et naturel";
  if (channel.toLowerCase().includes("courriel")) return "Envoyer un courriel de prise de contact";
  if (channel.toLowerCase().includes("facebook")) return "Ouvrir une conversation sans pression";
  return "Préparer l'appel et viser un rendez-vous d'évaluation";
}
