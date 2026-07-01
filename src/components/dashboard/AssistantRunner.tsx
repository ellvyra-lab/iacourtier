"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  FileText,
  MapPin,
  Upload,
} from "lucide-react";
import type { AssistantConfig } from "@/data/assistantsConfig";
import { Button } from "@/components/ui/Button";
import {
  buildContextPrompt,
  contextFromExtractedDocuments,
  contextFromSearchParams,
  isContextAwareAssistant,
  mergeAiContexts,
  summarizeAiContext,
  valuesFromAiContext,
  type AiPropertyContext,
} from "@/lib/ai-context";

type Status = "idle" | "loading" | "success" | "error";
type AssistantSearchParams = Record<string, string | string[] | undefined> | undefined;
type UploadStatus = "idle" | "loading" | "success" | "error";

export function AssistantRunner({ assistant, searchParams }: { assistant: AssistantConfig; searchParams?: AssistantSearchParams }) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const initialContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const [aiContext, setAiContext] = useState<AiPropertyContext | null>(initialContext);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAiContext(initialContext);
  }, [initialContext]);

  useEffect(() => {
    if (!aiContext || !isContextAwareAssistant(assistant.slug)) return;
    const contextValues = valuesFromAiContext(assistant.slug, aiContext);
    setValues((current) => ({
      ...current,
      ...contextValues,
      ai_context: JSON.stringify(aiContext),
      ai_context_prompt: buildContextPrompt(aiContext),
    }));
  }, [aiContext, assistant.slug]);

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

  async function importDocuments(files: FileList | null) {
    if (!files?.length) return;

    const acceptedFiles = Array.from(files).filter((file) => file.type === "application/pdf" || file.type.startsWith("image/") || /\.(pdf|png|jpg|jpeg|webp)$/i.test(file.name));
    if (!acceptedFiles.length) {
      setUploadStatus("error");
      setUploadMessage("Ajoutez un PDF ou une image lisible.");
      return;
    }

    const pdfFiles = acceptedFiles.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    const imageFiles = acceptedFiles.filter((file) => !pdfFiles.includes(file));

    setUploadStatus("loading");
    setUploadMessage("Lecture des documents en cours...");

    try {
      let documentContext: AiPropertyContext = {
        source: "documents",
        sourceLabel: "Documents uploadés",
        notes: imageFiles.length ? `Images ajoutées : ${imageFiles.map((file) => file.name).join(", ")}. À valider manuellement si les champs ne sont pas détectés.` : "",
      };

      if (pdfFiles.length) {
        const formData = new FormData();
        pdfFiles.forEach((file) => formData.append("files", file));
        const response = await fetch("/api/extract-mandate-documents", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as { fields?: Record<string, string>; fileNames?: string[]; error?: string };
        if (!response.ok || !payload.fields) throw new Error(payload.error || "Les documents n'ont pas pu être lus.");
        documentContext = mergeAiContexts(documentContext, contextFromExtractedDocuments(payload.fields, payload.fileNames ?? []));
      }

      setAiContext((current) => mergeAiContexts(current, documentContext));
      setUploadStatus("success");
      setUploadMessage("Les informations détectées ont été ajoutées au formulaire. Complétez seulement les champs manquants.");
    } catch (importError) {
      setUploadStatus("error");
      setUploadMessage(importError instanceof Error ? importError.message : "Les documents n'ont pas pu être analysés.");
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  const isLoading = status === "loading";
  const contextSummary = aiContext ? summarizeAiContext(aiContext, assistant.slug) : null;
  const contextAware = isContextAwareAssistant(assistant.slug);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- Form ---- */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-6"
      >
        {contextAware && !aiContext ? (
          <DocumentImportCard
            uploadStatus={uploadStatus}
            uploadMessage={uploadMessage}
            inputRef={uploadInputRef}
            onFiles={importDocuments}
          />
        ) : null}

        {contextSummary ? <AiContextCard summary={contextSummary} /> : null}

        {assistant.fields.filter((field) => !(aiContext && assistant.slug === "message-prospection" && field.name === "type_prospect")).map((field) => (
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

function DocumentImportCard({
  uploadStatus,
  uploadMessage,
  inputRef,
  onFiles,
}: {
  uploadStatus: UploadStatus;
  uploadMessage: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-electric-500/30 bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
          {uploadStatus === "loading" ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Importer les informations de la propriété</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Déposez une fiche Centris, un certificat, des taxes, une déclaration du vendeur, un acte de vente ou des photos. Les PDF texte seront lus automatiquement.
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => onFiles(event.target.files)}
          />
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>
            <FileText size={14} />
            Ajouter des documents
          </Button>
          {uploadMessage ? (
            <p className={uploadStatus === "error" ? "mt-3 text-sm text-amber-700" : "mt-3 text-sm text-muted"}>{uploadMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AiContextCard({ summary }: { summary: ReturnType<typeof summarizeAiContext> }) {
  const { context, foundFields, missingFields } = summary;
  return (
    <div className="rounded-2xl border border-electric-500/20 bg-electric-500/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-500">Données utilisées par l&apos;IA</p>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{context.address || context.sourceLabel}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <MapPin size={15} />
            {context.city || "Ville non précisée"} · Source : {context.sourceLabel}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <InfoPill label="Type" value={context.propertyType || "Non précisé"} icon={Building2} />
          <InfoPill label="Champs trouvés" value={foundFields.length ? foundFields.join(", ") : "Aucun champ détecté"} />
          <InfoPill label="Champs manquants" value={missingFields.length ? missingFields.join(", ") : "Rien d'essentiel"} />
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

function nextActionForChannel(channel = "") {
  if (channel.toLowerCase().includes("texto")) return "Envoyer un message court et naturel";
  if (channel.toLowerCase().includes("courriel")) return "Envoyer un courriel de prise de contact";
  if (channel.toLowerCase().includes("facebook")) return "Ouvrir une conversation sans pression";
  if (channel.toLowerCase().includes("appel")) return "Préparer l'appel et viser un rendez-vous d'évaluation";
  return "Compléter les champs manquants, puis générer";
}
