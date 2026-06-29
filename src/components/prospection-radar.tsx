"use client";

import type { ElementType } from "react";
import { useMemo, useState } from "react";
import { ArrowUpRight, Building2, Copy, Mail, MessageCircle, Phone, RotateCcw, Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { prospectionCategories, prospectionOpportunities, type ProspectionOpportunity, type ProspectionPriority } from "@/data/prospection-radar";
import { cn } from "@/lib/utils";

const priorities: Array<ProspectionPriority | "Toutes"> = ["Toutes", "Élevée", "Moyenne", "Faible"];

export function ProspectionRadar() {
  const [city, setCity] = useState("Toutes");
  const [propertyType, setPropertyType] = useState("Tous");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("Toutes");
  const [category, setCategory] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(prospectionOpportunities[0]?.id || "");
  const [copied, setCopied] = useState("");

  const cities = useMemo(() => ["Toutes", ...Array.from(new Set(prospectionOpportunities.map((item) => item.city))).sort()], []);
  const propertyTypes = useMemo(() => ["Tous", ...Array.from(new Set(prospectionOpportunities.map((item) => item.propertyType))).sort()], []);
  const categories = useMemo(() => ["Toutes", ...prospectionCategories], []);

  const filtered = useMemo(
    () =>
      prospectionOpportunities
        .filter((item) => city === "Toutes" || item.city === city)
        .filter((item) => propertyType === "Tous" || item.propertyType === propertyType)
        .filter((item) => priority === "Toutes" || item.priority === priority)
        .filter((item) => category === "Toutes" || item.category === category)
        .filter((item) => {
          const normalized = query.trim().toLowerCase();
          if (!normalized) return true;
          return [item.address, item.city, item.propertyType, item.category, item.reason].join(" ").toLowerCase().includes(normalized);
        })
        .sort((a, b) => b.score - a.score),
    [category, city, priority, propertyType, query],
  );

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || prospectionOpportunities[0];

  function resetFilters() {
    setCity("Toutes");
    setPropertyType("Tous");
    setPriority("Toutes");
    setCategory("Toutes");
    setQuery("");
  }

  async function copyAction(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1400);
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px] lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200">
              <Sparkles className="h-3.5 w-3.5" />
              Données simulées V1
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Radar de prospection IA</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Chaque matin, priorisez les propriétés qui méritent une action de prospection. Le radar regroupe les signaux clés et prépare les premiers messages pour accélérer votre journée.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <Metric label="Occasions" value={filtered.length.toString()} />
            <Metric label="Score moyen" value={Math.round(filtered.reduce((total, item) => total + item.score, 0) / Math.max(filtered.length, 1)).toString()} />
            <Metric label="Priorité élevée" value={filtered.filter((item) => item.priority === "Élevée").length.toString()} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une adresse, une ville, une catégorie..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:w-[720px]">
            <FilterSelect label="Ville" value={city} options={cities} onChange={setCity} />
            <FilterSelect label="Type" value={propertyType} options={propertyTypes} onChange={setPropertyType} />
            <FilterSelect label="Priorité" value={priority} options={priorities} onChange={(value) => setPriority(value as typeof priority)} />
            <FilterSelect label="Catégorie" value={category} options={categories} onChange={setCategory} />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <SlidersHorizontal className="h-4 w-4" />
            {filtered.length} opportunité{filtered.length > 1 ? "s" : ""} détectée{filtered.length > 1 ? "s" : ""}
          </div>

          {filtered.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} active={selected.id === opportunity.id} onSelect={() => setSelectedId(opportunity.id)} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/72 dark:text-slate-400">
              Aucune opportunité ne correspond aux filtres actuels.
            </div>
          )}
        </section>

        <ActionsPanel opportunity={selected} copied={copied} onCopy={copyAction} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label}: {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function OpportunityCard({ opportunity, active, onSelect }: { opportunity: ProspectionOpportunity; active: boolean; onSelect: () => void }) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-5 shadow-sm transition dark:bg-slate-900/72",
        active ? "border-teal-300 ring-4 ring-teal-500/10 dark:border-teal-800" : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={opportunity.priority} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{opportunity.category}</span>
          </div>
          <h2 className="mt-3 truncate text-lg font-semibold tracking-tight">{opportunity.address}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Building2 className="h-4 w-4" />
            {opportunity.city} · {opportunity.propertyType}
          </p>
        </div>
        <ScoreRing score={opportunity.score} />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{opportunity.reason}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {opportunity.signals.slice(0, 4).map((signal) => (
          <span key={signal} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {signal}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
      >
        Voir les actions IA
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? "text-emerald-600" : score >= 75 ? "text-teal-600" : "text-amber-600";

  return (
    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70">
      <span className={cn("text-lg font-bold", color)}>{score}</span>
      <span className="text-[10px] font-medium text-slate-400">/100</span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: ProspectionPriority }) {
  const className =
    priority === "Élevée"
      ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900"
      : priority === "Moyenne"
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900"
        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";

  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", className)}>{priority}</span>;
}

function ActionsPanel({ opportunity, copied, onCopy }: { opportunity: ProspectionOpportunity; copied: string; onCopy: (label: string, value: string) => void }) {
  const actionItems = [
    { label: "Premier message Facebook", icon: MessageCircle, value: opportunity.actions.facebook },
    { label: "Premier courriel", icon: Mail, value: opportunity.actions.email },
    { label: "Premier appel", icon: Phone, value: opportunity.actions.call },
    { label: "Message texte", icon: MessageCircle, value: opportunity.actions.sms },
    { label: "Relance après 7 jours", icon: RotateCcw, value: opportunity.actions.followUp7 },
    { label: "Relance après 30 jours", icon: RotateCcw, value: opportunity.actions.followUp30 },
  ];

  return (
    <aside className="xl:sticky xl:top-8 xl:self-start">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-premium dark:border-slate-800 dark:bg-slate-900/76">
        <div className="border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Actions IA</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{opportunity.address}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {opportunity.category} · Score {opportunity.score}/100
          </p>
        </div>

        <div className="space-y-4 p-5">
          {actionItems.map((item) => (
            <ActionBlock key={item.label} label={item.label} value={item.value} copied={copied === item.label} icon={item.icon} onCopy={() => onCopy(item.label, item.value)} />
          ))}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="text-sm font-semibold">Objections probables</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {opportunity.actions.objections.map((objection) => (
                <li key={objection}>- {objection}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900 dark:bg-teal-950/30">
            <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-100">Réponses suggérées</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-teal-900/80 dark:text-teal-100/80">
              {opportunity.actions.responses.map((response) => (
                <li key={response}>- {response}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ActionBlock({
  label,
  value,
  copied,
  icon: Icon,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  icon: ElementType;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/45">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-teal-600" />
          {label}
        </h3>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{value}</p>
    </div>
  );
}
