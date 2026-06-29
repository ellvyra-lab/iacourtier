"use client";

import type { DragEvent, ElementType } from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clipboard, Download, FileUp, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

import {
  analysisObjectives,
  analysisStyles,
  emptyComparable,
  type MarketAnalysisInput,
  type MarketComparable,
  type MarketSubjectProperty,
} from "@/lib/market-analysis";
import { cn } from "@/lib/utils";

type GenerateResponse = {
  text: string;
  id?: string;
  saved: boolean;
  fileName?: string;
  extractedText?: string;
  error?: string;
};

type Mode = "pdf" | "manual";

export function MarketAnalysisAssistant({
  mandatId,
  subjectProperty,
  returnHref,
}: {
  mandatId: string;
  subjectProperty: MarketSubjectProperty;
  returnHref: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("pdf");
  const [fileName, setFileName] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [comparables, setComparables] = useState<MarketComparable[]>([{ ...emptyComparable }]);
  const [objective, setObjective] = useState<(typeof analysisObjectives)[number]>("Préparer une rencontre vendeur");
  const [style, setStyle] = useState<(typeof analysisStyles)[number]>("Professionnel");
  const [generatedText, setGeneratedText] = useState("");
  const [generatedId, setGeneratedId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const validComparables = useMemo(
    () => comparables.filter((comparable) => comparable.address.trim() && comparable.city.trim() && comparable.price.trim()),
    [comparables],
  );

  const manualInput: MarketAnalysisInput = {
    mandatId,
    subjectProperty,
    comparables: validComparables,
    objective,
    style,
  };

  function resetResult() {
    setGeneratedText("");
    setGeneratedId(undefined);
    setCopied(false);
    setError("");
  }

  async function uploadPdf(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Le format accepté est PDF.");
      return;
    }

    resetResult();
    setFileName(file.name);
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mandatId", mandatId);
      formData.append("subjectProperty", JSON.stringify(subjectProperty));

      const response = await fetch("/api/analyse-comparative-pdf", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok) throw new Error(payload.error || "Le PDF n’a pas pu être lu automatiquement. Essayez un PDF texte ou utilisez la saisie manuelle.");

      setGeneratedText(payload.text);
      setGeneratedId(payload.id);
      setExtractedText(payload.extractedText || "");
      setFileName(payload.fileName || file.name);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Le PDF n’a pas pu être lu automatiquement. Essayez un PDF texte ou utilisez la saisie manuelle.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) uploadPdf(file);
  }

  function updateComparable<K extends keyof MarketComparable>(index: number, key: K, value: MarketComparable[K]) {
    setComparables((current) => current.map((comparable, itemIndex) => (itemIndex === index ? { ...comparable, [key]: value } : comparable)));
  }

  function addComparable() {
    if (comparables.length >= 10) return;
    setComparables((current) => [...current, { ...emptyComparable }]);
  }

  function removeComparable(index: number) {
    setComparables((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  async function generateManual() {
    if (!validComparables.length) {
      setError("Ajoutez au moins un comparable avec une adresse, une ville et un prix.");
      return;
    }

    resetResult();
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-market-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualInput),
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok) throw new Error(payload.error || "La génération a échoué.");

      setGeneratedText(payload.text);
      setGeneratedId(payload.id);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "La génération a échoué.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveAnalysis() {
    if (generatedId || !generatedText) return;

    setIsSaving(true);
    setError("");

    try {
      const body =
        mode === "pdf"
          ? {
              mandatId,
              sourceType: "pdf",
              fileName,
              extractedText,
              subjectProperty,
              generatedText,
            }
          : { ...manualInput, sourceType: "manual", generatedText };

      const response = await fetch("/api/market-analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { id?: string; error?: string };

      if (response.ok && payload.id) {
        setGeneratedId(payload.id);
        return;
      }

      const id = `local-market-analysis-${Date.now()}`;
      const storageKey = `iacourtier-market-analyses-${mandatId}`;
      const existing = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as Array<Record<string, unknown>>;
      const record = {
        id,
        mandat_id: mandatId,
        source_type: mode,
        file_name: fileName || null,
        extracted_text: extractedText || null,
        subject_property: subjectProperty,
        comparables: manualInput.comparables,
        objective,
        style,
        generated_text: generatedText,
        created_at: new Date().toISOString(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify([record, ...existing]));
      setGeneratedId(id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "La sauvegarde a échoué.");
    } finally {
      setIsSaving(false);
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(generatedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadText() {
    const blob = new Blob([generatedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analyse-comparative-${subjectProperty.city || "mandat"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <section className="space-y-5">
        <SubjectSummary subjectProperty={subjectProperty} />

        <div className="grid gap-4 lg:grid-cols-2">
          <OptionCard
            active={mode === "pdf"}
            badge="Recommandé"
            title="Importer un PDF d’analyse comparative"
            text="Déposez votre rapport de comparables, analyse Centris, PDF MLS ou document d’analyse. IACourtier lira le document et préparera une synthèse claire pour votre rencontre vendeur."
            buttonLabel="Déposer un PDF"
            onClick={() => {
              setMode("pdf");
              inputRef.current?.click();
            }}
          />
          <OptionCard
            active={mode === "manual"}
            title="Saisie manuelle"
            text="Utilisez cette option seulement si vous n’avez pas de PDF."
            buttonLabel="Saisir les comparables manuellement"
            onClick={() => {
              setMode("manual");
              resetResult();
            }}
            secondary
          />
        </div>

        {mode === "pdf" ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => event.target.files?.[0] && uploadPdf(event.target.files[0])} />
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-teal-400 hover:bg-white dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-teal-700 dark:hover:bg-slate-950"
            >
              <FileUp className="h-10 w-10 text-teal-600" />
              <span className="mt-4 text-base font-semibold">Déposer un PDF</span>
              <span className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">Glissez votre fichier ici ou cliquez pour choisir un document. Format accepté : PDF.</span>
              {fileName ? <span className="mt-4 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-200">{fileName}</span> : null}
            </label>
          </div>
        ) : (
          <ManualComparableForm
            comparables={comparables}
            objective={objective}
            style={style}
            isGenerating={isGenerating}
            onAddComparable={addComparable}
            onRemoveComparable={removeComparable}
            onUpdateComparable={updateComparable}
            onObjectiveChange={(value) => setObjective(value as typeof objective)}
            onStyleChange={(value) => setStyle(value as typeof style)}
            onGenerate={generateManual}
          />
        )}

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}
      </section>

      <ResultPanel
        generatedText={generatedText}
        generatedId={generatedId}
        copied={copied}
        isGenerating={isGenerating}
        isSaving={isSaving}
        returnHref={returnHref}
        onCopy={copyText}
        onDownload={downloadText}
        onRegenerate={() => (mode === "pdf" && inputRef.current?.files?.[0] ? uploadPdf(inputRef.current.files[0]) : generateManual())}
        onSave={saveAnalysis}
      />
    </div>
  );
}

function SubjectSummary({ subjectProperty }: { subjectProperty: MarketSubjectProperty }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Mandat lié</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          ["Adresse", subjectProperty.address],
          ["Ville", subjectProperty.city],
          ["Type", subjectProperty.propertyType],
          ["Prix demandé", subjectProperty.askingPrice || "À préciser"],
          ["Chambres", subjectProperty.bedrooms || "À préciser"],
          ["Salles de bain", subjectProperty.bathrooms || "À préciser"],
          ["Superficie", subjectProperty.livingArea || "À préciser"],
          ["Terrain", subjectProperty.landArea || "À préciser"],
          ["Année", subjectProperty.yearBuilt || "À préciser"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
      {subjectProperty.highlights ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{subjectProperty.highlights}</p> : null}
    </div>
  );
}

function OptionCard({
  active,
  badge,
  title,
  text,
  buttonLabel,
  onClick,
  secondary,
}: {
  active: boolean;
  badge?: string;
  title: string;
  text: string;
  buttonLabel: string;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <article className={cn("rounded-lg border p-5 shadow-sm transition", active ? "border-teal-300 bg-white dark:border-teal-800 dark:bg-slate-900/72" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60")}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {badge ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-200">{badge}</span> : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "mt-5 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition",
          secondary ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" : "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950",
        )}
      >
        {buttonLabel}
      </button>
    </article>
  );
}

function ManualComparableForm({
  comparables,
  objective,
  style,
  isGenerating,
  onAddComparable,
  onRemoveComparable,
  onUpdateComparable,
  onObjectiveChange,
  onStyleChange,
  onGenerate,
}: {
  comparables: MarketComparable[];
  objective: string;
  style: string;
  isGenerating: boolean;
  onAddComparable: () => void;
  onRemoveComparable: (index: number) => void;
  onUpdateComparable: <K extends keyof MarketComparable>(index: number, key: K, value: MarketComparable[K]) => void;
  onObjectiveChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Saisie manuelle</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Entrez vos comparables</h2>
          </div>
          <button type="button" onClick={onAddComparable} disabled={comparables.length >= 10} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950">
            <Plus className="h-4 w-4" />
            Ajouter un comparable
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {comparables.map((comparable, index) => (
            <ComparableFields key={index} index={index} comparable={comparable} canRemove={comparables.length > 1} onChange={onUpdateComparable} onRemove={() => onRemoveComparable(index)} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <h2 className="text-xl font-semibold">Options d’analyse</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <OptionGroup label="Objectif de l’analyse" value={objective} options={analysisObjectives} onChange={onObjectiveChange} />
          <OptionGroup label="Style" value={style} options={analysisStyles} onChange={onStyleChange} />
        </div>
        <button type="button" onClick={onGenerate} disabled={isGenerating} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950">
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Générer l’analyse comparative
        </button>
      </div>
    </div>
  );
}

function ResultPanel({
  generatedText,
  generatedId,
  copied,
  isGenerating,
  isSaving,
  returnHref,
  onCopy,
  onDownload,
  onRegenerate,
  onSave,
}: {
  generatedText: string;
  generatedId?: string;
  copied: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  returnHref: string;
  onCopy: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
  onSave: () => void;
}) {
  return (
    <aside className="xl:sticky xl:top-8 xl:self-start">
      {isGenerating ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-premium dark:border-slate-800 dark:bg-slate-900/76">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            Analyse du PDF en cours…
          </div>
        </div>
      ) : generatedText ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-premium dark:border-slate-800 dark:bg-slate-900/76">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Analyse générée</p>
              <h2 className="text-xl font-semibold">Synthèse vendeur</h2>
            </div>
            {generatedId ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-200">
                <Check className="h-3.5 w-3.5" />
                Sauvegardée
              </span>
            ) : null}
          </div>

          <StructuredAnalysisView text={generatedText} />

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <ActionButton icon={copied ? Check : Clipboard} label={copied ? "Copié" : "Copier"} onClick={onCopy} />
            <ActionButton icon={RefreshCw} label="Régénérer" onClick={onRegenerate} />
            <ActionButton icon={Save} label={generatedId ? "Sauvegardée" : isSaving ? "Sauvegarde..." : "Sauvegarder"} onClick={onSave} />
            <ActionButton icon={Download} label="Télécharger .txt" onClick={onDownload} />
            <Link href={returnHref} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 sm:col-span-2">
              Retour au mandat
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/72 p-6 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900/56 dark:text-slate-300">
          Déposez votre PDF de comparables. IACourtier préparera une synthèse claire pour votre rencontre vendeur.
        </div>
      )}
    </aside>
  );
}

function StructuredAnalysisView({ text }: { text: string }) {
  const sections = splitAnalysisSections(text);

  return (
    <div className="mt-5 space-y-4">
      {sections.map((section, index) => {
        const isPriceSection = /fourchette|prix de mise en march/i.test(section.title);

        return (
          <section
            key={`${section.title}-${index}`}
            className={cn(
              "rounded-lg border p-4",
              isPriceSection
                ? "border-teal-200 bg-teal-50/70 dark:border-teal-900 dark:bg-teal-950/30"
                : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/45",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{section.title}</h3>
              {isPriceSection ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200 dark:bg-slate-950 dark:text-teal-200 dark:ring-teal-900">À valider</span> : null}
            </div>
            <div className="mt-3 space-y-3">
              {renderAnalysisBlocks(section.body)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function splitAnalysisSections(text: string) {
  const lines = text.split(/\r?\n/);
  const sections: Array<{ title: string; body: string }> = [];
  let currentTitle = "Analyse comparative";
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = line.match(/^\s*(?:#{1,3}\s*)?(?:\d{1,2}[.)]\s*)?(.+?)\s*$/);
    const normalized = heading?.[1]?.replace(/\*\*/g, "").trim() || "";
    const looksLikeSection =
      normalized.length > 0 &&
      normalized.length < 90 &&
      /^(Résumé|Tableau|Grille|Comparables|Ajustements|Fourchette|Prix|Arguments|Objections|Note de prudence)/i.test(normalized);

    if (looksLikeSection) {
      if (currentLines.join("\n").trim()) {
        sections.push({ title: currentTitle, body: currentLines.join("\n").trim() });
      }
      currentTitle = normalized.replace(/:$/, "");
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.join("\n").trim()) {
    sections.push({ title: currentTitle, body: currentLines.join("\n").trim() });
  }

  return sections.length ? sections : [{ title: "Analyse comparative", body: text }];
}

function renderAnalysisBlocks(body: string) {
  const blocks: JSX.Element[] = [];
  const lines = body.split(/\r?\n/);
  let paragraph: string[] = [];
  let table: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
        {paragraph.join("\n")}
      </p>,
    );
    paragraph = [];
  }

  function flushTable() {
    if (!table.length) return;
    blocks.push(<AnalysisTable key={`t-${blocks.length}`} lines={table} />);
    table = [];
  }

  for (const line of lines) {
    if (line.trim().startsWith("|") && line.includes("|")) {
      flushParagraph();
      table.push(line);
      continue;
    }

    flushTable();
    if (line.trim()) paragraph.push(line);
  }

  flushParagraph();
  flushTable();

  return blocks.length ? blocks : <p className="text-sm text-slate-500 dark:text-slate-400">non détecté</p>;
}

function AnalysisTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*-{3,}/.test(line))
    .map((line) =>
      line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean),
    )
    .filter((row) => row.length);

  const [head, ...body] = rows;
  if (!head) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
          <thead className="bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            <tr>
              {head.map((cell) => (
                <th key={cell} className="px-3 py-2 font-semibold">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {head.map((_, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                    <SimilarityBadge value={row[cellIndex] || "non détecté"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimilarityBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const badge =
    normalized.includes("très pertinent") || normalized.includes("tres pertinent")
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900"
      : normalized.includes("à utiliser avec prudence") || normalized.includes("a utiliser avec prudence")
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900"
        : normalized.includes("peu comparable")
          ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900"
          : normalized.includes("pertinent")
            ? "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-900"
            : "";

  if (!badge) return <span>{value}</span>;

  return <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1", badge)}>{value}</span>;
}

function ComparableFields({
  index,
  comparable,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  comparable: MarketComparable;
  canRemove: boolean;
  onChange: <K extends keyof MarketComparable>(index: number, key: K, value: MarketComparable[K]) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">Comparable {index + 1}</h3>
        <button type="button" onClick={onRemove} disabled={!canRemove} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Trash2 className="h-3.5 w-3.5" />
          Retirer
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Adresse" value={comparable.address} onChange={(value) => onChange(index, "address", value)} />
        <Field label="Ville" value={comparable.city} onChange={(value) => onChange(index, "city", value)} />
        <Field label="Prix vendu ou demandé" value={comparable.price} onChange={(value) => onChange(index, "price", value)} />
        <Field label="Date de vente" value={comparable.saleDate} onChange={(value) => onChange(index, "saleDate", value)} />
        <Field label="Type de propriété" value={comparable.propertyType} onChange={(value) => onChange(index, "propertyType", value)} />
        <Field label="Chambres" value={comparable.bedrooms} onChange={(value) => onChange(index, "bedrooms", value)} />
        <Field label="Chambres hors sol" value={comparable.aboveGroundBedrooms} onChange={(value) => onChange(index, "aboveGroundBedrooms", value)} />
        <Field label="Salles de bain" value={comparable.bathrooms} onChange={(value) => onChange(index, "bathrooms", value)} />
        <Field label="Superficie habitable" value={comparable.livingArea} onChange={(value) => onChange(index, "livingArea", value)} />
        <Field label="Superficie terrain" value={comparable.landArea} onChange={(value) => onChange(index, "landArea", value)} />
        <Field label="Année de construction" value={comparable.yearBuilt} onChange={(value) => onChange(index, "yearBuilt", value)} />
        <Field label="Garage" value={comparable.garage} onChange={(value) => onChange(index, "garage", value)} />
        <Field label="Piscine" value={comparable.pool} onChange={(value) => onChange(index, "pool", value)} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Textarea label="Notes du courtier" value={comparable.brokerNotes} onChange={(value) => onChange(index, "brokerNotes", value)} />
        <Textarea label="Forces" value={comparable.strengths} onChange={(value) => onChange(index, "strengths", value)} />
        <Textarea label="Faiblesses" value={comparable.weaknesses} onChange={(value) => onChange(index, "weaknesses", value)} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950" />
    </label>
  );
}

function OptionGroup({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm font-medium transition",
              value === option
                ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
