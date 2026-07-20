"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Copy, ExternalLink, Mail, MessageCircle, Phone, Plus, RotateCcw, Save, Search, Sparkles } from "lucide-react";

import { analyzeCallTranscript, createCallCoachFeedback, type CallAnalysis } from "@/lib/call-intelligence";
import { generateClientCommunication, type ClientCommunicationOutput } from "@/lib/client-communication/engine";
import { contextFromPipelineStatus, getContextualAiActions } from "@/lib/ai-actions";
import { getSoniaProspect, recordCallResult, updateProspectStatus, updateSoniaProspect, type SoniaProspect } from "@/lib/sonia-beta";
import type { RecordedCallResult } from "@/lib/sonia-beta/storage";
import { officialSellerWorkflow } from "@/lib/business-rules";
import { cn } from "@/lib/utils";
import { VoiceDictationButton } from "@/components/voice-dictation-button";

type PreparedCall = {
  script: ClientCommunicationOutput;
  voicemail: string;
  noAnswerText: string;
  messenger: string;
};

const callResults: Array<{ id: RecordedCallResult; label: string }> = [
  { id: "a_repondu", label: "A répondu" },
  { id: "message_laisse", label: "Message laissé" },
  { id: "pas_repondu", label: "Pas de réponse" },
  { id: "mauvais_numero", label: "Mauvais numéro" },
  { id: "pas_interesse", label: "Pas intéressé" },
  { id: "a_rappeler", label: "À rappeler" },
  { id: "rendez_vous_obtenu", label: "Rendez-vous obtenu" },
  { id: "projet_futur", label: "Projet futur" },
  { id: "ne_plus_contacter", label: "Ne plus contacter" },
];

export function ProspectDetail({ id, demoCall = false }: { id: string; demoCall?: boolean }) {
  const [prospect, setProspect] = useState<SoniaProspect | null>(null);
  const [callStarted, setCallStarted] = useState(false);
  const [callResult, setCallResult] = useState<RecordedCallResult>("pas_repondu");
  const [callNote, setCallNote] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callOccurredAt, setCallOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [resultFollowupDate, setResultFollowupDate] = useState("");
  const [mainObjection, setMainObjection] = useState("");
  const [interestLevel, setInterestLevel] = useState<"froid" | "tiède" | "chaud">("tiède");
  const [preparedCall, setPreparedCall] = useState<PreparedCall | null>(null);
  const [followupDate, setFollowupDate] = useState("");
  const [keepLongTerm, setKeepLongTerm] = useState(true);
  const [copiedField, setCopiedField] = useState("");
  const [newNote, setNewNote] = useState("");
  const [callStatus, setCallStatus] = useState("");
  const [coachAnalysis, setCoachAnalysis] = useState<CallAnalysis | null>(null);
  const [demoCallInitialized, setDemoCallInitialized] = useState(false);

  useEffect(() => {
    setProspect(getSoniaProspect(id));
  }, [id]);

  useEffect(() => {
    if (!demoCall || !prospect || demoCallInitialized) return;
    setCallStarted(true);
    setCallStatus("Mode démo : l’appel est simulé. Choisissez le résultat de l’appel, ajoutez une note, puis IACourtier générera le feedback Coach et la prochaine relance.");
    setDemoCallInitialized(true);
  }, [demoCall, prospect, demoCallInitialized]);

  const aiContext = prospect ? contextFromPipelineStatus(prospect.status, prospect.clientType) : "prospect vendeur";
  const recommendedActions = useMemo(() => getContextualAiActions(aiContext), [aiContext]);
  const nextBestAction = recommendedActions[0];
  const coach = useMemo(() => (coachAnalysis ? createCallCoachFeedback(coachAnalysis) : null), [coachAnalysis]);

  if (!prospect) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="text-lg font-semibold">Prospect introuvable</p>
        <Link href="/tableau-de-bord" className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
          Retour au plan de bataille
        </Link>
      </div>
    );
  }

  function refresh(updated: SoniaProspect | null) {
    if (updated) setProspect(updated);
  }

  function prepareCall() {
    if (!prospect) return;
    const context = {
      clientName: prospect.name,
      address: prospect.address,
      city: prospect.city,
      propertyType: extractNoteValue(prospect.notes, "Type") || "propriété résidentielle",
      sector: prospect.city,
      ownershipDuration: extractNoteValue(prospect.notes, "Années détention") || extractNoteValue(prospect.notes, "Durée de détention") || "non précisée",
      score: extractNoteValue(prospect.notes, "Score") || extractNoteValue(prospect.notes, "Priorité") || "non disponible",
      signals: extractNoteValue(prospect.notes, "Signaux détectés") || extractNoteValue(prospect.notes, "Pourquoi ce prospect") || "aucun signal consigné",
      source: prospect.source,
      previousAttempts: prospect.history.filter((event) => event.type === "call").map((event) => event.title).join(" · ") || "aucune tentative",
      previousObjections: prospect.history.filter((event) => /objection/i.test(event.description)).map((event) => event.description).join(" · ") || "aucune objection consignée",
    };
    const script = generateClientCommunication({
      clientType: prospect.clientType === "buyer" ? "acheteur" : "vendeur",
      journeyStage: "prospection initiale",
      channel: "téléphone",
      objective: "Comprendre le projet immobilier et convenir d’une prochaine étape utile, sans pression.",
      warmth: "froid",
      context,
      tone: "chaleureux",
      length: "détaillée",
    });
    const voicemail = generateClientCommunication({
      clientType: prospect.clientType === "buyer" ? "acheteur" : "vendeur",
      journeyStage: "message vocal après appel sans réponse",
      channel: "téléphone",
      objective: "Laisser un message vocal court, humain et sans pression.",
      warmth: "froid",
      context,
      tone: "rassurant",
      length: "courte",
    });
    const noAnswerText = generateClientCommunication({
      clientType: prospect.clientType === "buyer" ? "acheteur" : "vendeur",
      journeyStage: "texto après appel sans réponse",
      channel: "texto",
      objective: "Expliquer simplement la raison de l’appel et offrir une réponse facile.",
      warmth: "froid",
      context,
      tone: "rassurant",
      length: "courte",
    });
    const messenger = generateClientCommunication({
      clientType: prospect.clientType === "buyer" ? "acheteur" : "vendeur",
      journeyStage: "premier contact Messenger",
      channel: "messenger",
      objective: "Ouvrir une conversation immobilière locale sans pression.",
      warmth: "froid",
      context,
      tone: "chaleureux",
      length: "courte",
    });
    setPreparedCall({
      script,
      voicemail: voicemail.shortVersion,
      noAnswerText: noAnswerText.shortVersion,
      messenger: messenger.shortVersion,
    });
    window.setTimeout(() => document.getElementById("prepared-call")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function startCall() {
    if (!prospect) return;
    setCallStarted(true);
    if (!prospect.phone) {
      setCallStatus("Aucun numéro disponible. Utilisez la recherche de coordonnées.");
      return;
    }
    setCallStatus("Application téléphonique ouverte. Revenez ensuite enregistrer le résultat de l’appel.");
    window.setTimeout(() => document.getElementById("call-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    window.location.href = `tel:${normalizePhoneForLink(prospect.phone)}`;
  }

  function saveCallResult() {
    if (!prospect) return;
    if ((callResult === "a_rappeler" || callResult === "projet_futur") && !callbackDate) {
      setCallStatus(callResult === "projet_futur" ? "Indiquez l’échéance estimée du projet." : "Indiquez la date et l’heure du rappel.");
      return;
    }
    let updated = recordCallResult(prospect.id, callResult, callNote, callbackDate, {
      occurredAt: callOccurredAt ? new Date(callOccurredAt).toISOString() : undefined,
      followupDate: resultFollowupDate || undefined,
      objection: mainObjection || undefined,
      interest: interestLevel,
    });
    if (callResult === "pas_interesse" && !keepLongTerm) {
      updated = updateSoniaProspect(prospect.id, (current) => ({
        ...current,
        nextAction: "Archiver de la prospection active",
        nextActionDate: "",
        history: [{
          id: `long-term-${Date.now()}`,
          date: new Date().toISOString(),
          title: "Suivi long terme refusé",
          description: "Le courtier a choisi de ne pas placer ce prospect en suivi long terme.",
          type: "task",
        }, ...current.history],
      }));
    }
    refresh(updated);
    const analysis = analyzeCallTranscript({
      id: `call-${prospect.id}-${Date.now()}`,
      transcript: callNote || `Courtier: Appel effectué. Résultat: ${callResults.find((item) => item.id === callResult)?.label}.`,
      duration: 300,
    });
    setCoachAnalysis(analysis);
    setCallStatus("Résultat enregistré. Le Coach a préparé le feedback et la prochaine action.");
  }

  function saveNote() {
    if (!prospect) return;
    const updated = updateSoniaProspect(prospect.id, (current) => ({
      ...current,
      notes: [current.notes, newNote.trim()].filter(Boolean).join("\n\n"),
      history: [
        {
          id: `note-${Date.now()}`,
          date: new Date().toISOString(),
          title: "Note ajoutée",
          description: newNote.trim(),
          type: "note",
        },
        ...current.history,
      ],
    }));
    setNewNote("");
    refresh(updated);
  }

  function markAppointmentObtained() {
    if (!prospect) return;
    refresh(updateProspectStatus(prospect.id, officialSellerWorkflow[3], "Préparer analyse de marché"));
  }

  function markMandateSigned() {
    if (!prospect) return;
    refresh(updateProspectStatus(prospect.id, officialSellerWorkflow[7], "Demander documents vendeur et préparer mise en marché"));
  }

  function planFollowup() {
    if (!prospect) return;
    const date = followupDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    refresh(
      updateSoniaProspect(prospect.id, (current) => ({
        ...current,
        nextAction: "Relance planifiée",
        nextActionDate: date,
        history: [
          {
            id: `followup-${Date.now()}`,
            date: new Date().toISOString(),
            title: "Relance planifiée",
            description: `Relance prévue le ${date}.`,
            type: "task",
          },
          ...current.history,
        ],
      })),
    );
  }

  function appendCallTranscript(transcript: string) {
    setCallNote((current) => [current.trim(), transcript.trim()].filter(Boolean).join(" "));
  }

  async function copyValue(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(label);
  }

  function openSearch(provider: "google" | "facebook", includeAddress = true) {
    if (!prospect) return;
    const query = [prospect.name, includeAddress ? prospect.address : "", includeAddress ? prospect.city : ""].filter(Boolean).join(" ");
    const url = provider === "facebook"
      ? `https://www.facebook.com/search/top?q=${encodeURIComponent(query)}`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-7">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Fiche prospect / client</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{prospect.name}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{prospect.address}, {prospect.city}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{prospect.status}</Badge>
              <Badge>{prospect.clientType === "seller" ? "Vendeur" : "Acheteur"}</Badge>
              <Badge>Source : {prospect.source}</Badge>
              <Badge>Score : {extractNoteValue(prospect.notes, "Score") || extractNoteValue(prospect.notes, "Priorité") || "Non disponible"}</Badge>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              <span className="font-semibold">Raisons du score :</span> {extractNoteValue(prospect.notes, "Pourquoi ce prospect") || extractNoteValue(prospect.notes, "Raison") || "Aucune raison consignée."}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prochaine action</p>
            <p className="mt-2 text-lg font-semibold">{prospect.nextAction}</p>
            <p className="mt-1 text-sm text-slate-500">{prospect.nextActionDate}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <main className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <h2 className="text-lg font-semibold">Coordonnées</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Téléphone" value={prospect.phone || "Non renseigné"} />
              <Info label="Courriel" value={prospect.email || "Non renseigné"} />
              <Info label="Adresse" value={prospect.address} />
              <Info label="Ville" value={prospect.city} />
              <Info label="Source des coordonnées" value={extractNoteValue(prospect.notes, "Source des coordonnées") || prospect.source} />
              <Info label="Niveau de confiance" value={extractNoteValue(prospect.notes, "Niveau de confiance") || extractNoteValue(prospect.notes, "Confiance") || "À confirmer"} />
              <Info label="Dernier résultat" value={prospect.history.find((event) => event.type === "call")?.title.replace("Résultat de l'appel : ", "") || "Aucun appel enregistré"} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button type="button" onClick={prepareCall} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100">
                <Sparkles className="h-4 w-4" />
                Préparer mon appel
              </button>
              {prospect.phone ? (
                <a
                  href={`tel:${normalizePhoneForLink(prospect.phone)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    startCall();
                  }}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                >
                  <Phone className="h-4 w-4" />
                  Appeler maintenant
                </a>
              ) : (
                <button type="button" disabled className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <Phone className="h-4 w-4" />
                  Appeler maintenant — numéro manquant
                </button>
              )}
              <a href={prospect.phone ? `sms:${prospect.phone}` : undefined} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-950">
                <MessageCircle className="h-4 w-4" />
                Envoyer texto
              </a>
              <a href={prospect.email ? `mailto:${prospect.email}` : undefined} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-950">
                <Mail className="h-4 w-4" />
                Préparer courriel
              </a>
              <button onClick={markAppointmentObtained} type="button" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
                <CalendarPlus className="h-4 w-4" />
                Marquer rendez-vous obtenu
              </button>
              <button onClick={markMandateSigned} type="button" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                <Save className="h-4 w-4" />
                Mandat signé
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Link href={`/tableau-de-bord/actions/prepare-first-seller-call?name=${encodeURIComponent(prospect.name)}&address=${encodeURIComponent(prospect.address)}&city=${encodeURIComponent(prospect.city)}&channel=sms&context=prospect`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-700"><MessageCircle className="h-4 w-4" />Préparer un message</Link>
              <button type="button" onClick={() => openSearch("google")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-700"><Search className="h-4 w-4" />Rechercher les coordonnées</button>
              <button type="button" onClick={() => openSearch("google")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-700"><ExternalLink className="h-4 w-4" />Rechercher sur le Web</button>
              <button type="button" onClick={() => openSearch("facebook")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-700"><ExternalLink className="h-4 w-4" />Rechercher sur Facebook</button>
              <button type="button" onClick={() => copyValue("name", prospect.name)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-700"><Copy className="h-4 w-4" />{copiedField === "name" ? "Nom copié" : "Copier le nom"}</button>
              <button type="button" onClick={() => copyValue("address", [prospect.address, prospect.city].filter(Boolean).join(", "))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-700"><Copy className="h-4 w-4" />{copiedField === "address" ? "Adresse copiée" : "Copier l’adresse"}</button>
            </div>
            {callStatus ? <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">{callStatus}</p> : null}
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-sm font-semibold">Planifier relance</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input type="date" value={followupDate} onChange={(event) => setFollowupDate(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" />
                <button onClick={planFollowup} type="button" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900">
                  <CalendarPlus className="h-4 w-4" />
                  Planifier relance
                </button>
              </div>
            </div>
          </section>

          {preparedCall ? (
            <section id="prepared-call" className="scroll-mt-4 rounded-lg border border-teal-200 bg-teal-50/60 p-4 shadow-sm dark:border-teal-900 dark:bg-teal-950/20 sm:p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-teal-700" />Script d&apos;appel préparé</h2>
              <div className="mt-4 grid gap-3">
                <CoachLine label="1. Ouverture naturelle et raison de l’appel" value={preparedCall.script.mainMessage} />
                <CoachLine label="2. Version courte" value={preparedCall.script.shortVersion} />
                <CoachLine label="3. Première question ouverte" value={preparedCall.script.followUpQuestion} />
                <CoachLine label="4. Questions de découverte" value="Qu’est-ce qui est le plus important pour vous dans la suite? · Qu’est-ce qui vous ferait considérer un changement? · Comment aimeriez-vous être accompagné?" />
                <CoachLine label="5. Réponse aux objections" value="Je comprends. Qu’est-ce qui vous ferait sentir qu’une conversation serait utile, même sans prendre de décision aujourd’hui?" />
                <CoachLine label="6. Prochaine étape suggérée" value={preparedCall.script.recommendedNextAction} />
                <CoachLine label="Message vocal" value={preparedCall.voicemail} />
                <CoachLine label="Texto après appel sans réponse" value={preparedCall.noAnswerText} />
                <CoachLine label="Facebook / Messenger" value={preparedCall.messenger} />
              </div>
            </section>
          ) : null}

          <section id="call-result" className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72 sm:p-5">
            <h2 className="text-lg font-semibold">Enregistrer le résultat de l&apos;appel</h2>
            {!callStarted ? <p className="mt-2 text-sm text-slate-500">Lancez un appel ou utilisez ce bloc après un appel déjà fait.</p> : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {callResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCallResult(item.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm font-semibold transition",
                    callResult === item.id ? "border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-50" : "border-slate-200 bg-slate-50 hover:border-teal-200 dark:border-slate-800 dark:bg-slate-950/50",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {callResult === "a_rappeler" || callResult === "projet_futur" ? (
              <label className="mt-4 block text-sm font-semibold">
                {callResult === "projet_futur" ? "Échéance estimée du projet" : "Date de rappel"}
                <input type="datetime-local" value={callbackDate} onChange={(event) => setCallbackDate(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" />
              </label>
            ) : null}
            {callResult === "pas_interesse" ? (
              <fieldset className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <legend className="px-1 text-sm font-semibold">Placer ce prospect en suivi long terme?</legend>
                <div className="mt-2 flex gap-5 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" checked={keepLongTerm} onChange={() => setKeepLongTerm(true)} />Oui</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={!keepLongTerm} onChange={() => setKeepLongTerm(false)} />Non</label>
                </div>
              </fieldset>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Date et heure de l&apos;appel
                <input type="datetime-local" value={callOccurredAt} onChange={(event) => setCallOccurredAt(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-sm font-semibold">Prochaine date de suivi
                <input type="datetime-local" value={resultFollowupDate} onChange={(event) => setResultFollowupDate(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-sm font-semibold">Objection principale
                <input value={mainObjection} onChange={(event) => setMainObjection(event.target.value)} placeholder="Ex. Je veux attendre au printemps" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-sm font-semibold">Niveau d&apos;intérêt
                <select value={interestLevel} onChange={(event) => setInterestLevel(event.target.value as "froid" | "tiède" | "chaud")} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                  <option value="froid">Froid</option>
                  <option value="tiède">Tiède</option>
                  <option value="chaud">Chaud</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-semibold" htmlFor="call-note">Note d&apos;appel</label>
              <VoiceDictationButton onTranscript={appendCallTranscript} />
            </div>
            <textarea
              id="call-note"
              value={callNote}
              onChange={(event) => setCallNote(event.target.value)}
              placeholder="Ex. Le propriétaire est curieux de connaître la valeur, mais veut attendre au printemps."
              className="mt-3 min-h-32 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950"
            />
            <button onClick={saveCallResult} type="button" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
              <RotateCcw className="h-4 w-4" />
              Enregistrer et créer la prochaine action
            </button>

            {coach ? (
              <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900 dark:bg-teal-950/30">
                <p className="flex items-center gap-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
                  <Sparkles className="h-4 w-4" />
                  Coach IA après appel
                </p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <CoachLine label="Résumé" value={coachAnalysis?.summary || "Appel analysé."} />
                  <CoachLine label="Ce qui était bon" value={coach.good} />
                  <CoachLine label="À améliorer" value={coach.improve} />
                  <CoachLine label="Prochaine meilleure question" value={coach.topSellerQuestion} />
                  <CoachLine label="Message de relance recommandé" value={coach.nextFollowup} />
                  <CoachLine label="Prochaine action" value={prospect.nextAction} />
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <h2 className="text-lg font-semibold">Notes</h2>
            <textarea value={newNote} onChange={(event) => setNewNote(event.target.value)} className="mt-3 min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" placeholder="Ajouter une note au dossier..." />
            <button disabled={!newNote.trim()} onClick={saveNote} type="button" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">
              <Plus className="h-4 w-4" />
              Ajouter note
            </button>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{prospect.notes}</p>
          </section>
        </main>

        <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <section className="rounded-lg border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30">
            <p className="flex items-center gap-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
              <Sparkles className="h-4 w-4" />
              Prochaine meilleure action
            </p>
            {nextBestAction ? (
              <div className="mt-4 rounded-lg border border-teal-200/80 bg-white p-4 dark:border-teal-900 dark:bg-slate-950/45">
                <p className="text-sm font-semibold">{nextBestAction.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{nextBestAction.description}</p>
                <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm leading-6 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100">
                  {bestActionCoachLine(prospect.status)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextBestAction.outputs.slice(0, 4).map((output) => (
                    <span key={output} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700">{output}</span>
                  ))}
                </div>
                {nextBestAction.href ? (
                  <Link href={buildProspectContextHref(nextBestAction.href, prospect)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                    Commencer
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <h2 className="text-lg font-semibold">Historique</h2>
            <div className="mt-5 space-y-4">
              {prospect.history.map((event) => (
                <div key={event.id} className="relative border-l border-slate-200 pl-4 dark:border-slate-800">
                  <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-teal-600 ring-4 ring-white dark:ring-slate-900" />
                  <p className="text-sm font-semibold">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.date))}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{event.description}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function normalizePhoneForLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : phone.startsWith("+") ? phone : `+${digits}`;
}

function extractNoteValue(notes: string, label: string) {
  const line = notes.split("\n").find((item) => item.toLowerCase().startsWith(label.toLowerCase()));
  return line?.split(":").slice(1).join(":").trim();
}

function buildProspectContextHref(href: string, prospect: SoniaProspect) {
  if (!href.includes("/tableau-de-bord/assistants/") && !href.includes("/tableau-de-bord/actions/")) return href;

  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("context", "prospect");
  params.set("name", prospect.name || "");
  params.set("address", prospect.address || "");
  params.set("city", prospect.city || "");
  params.set("phone", prospect.phone || "");
  params.set("email", prospect.email || "");
  params.set("notes", [prospect.notes, `Statut : ${prospect.status}`, `Prochaine action : ${prospect.nextAction}`].filter(Boolean).join("\n"));
  params.set("channel", href.includes("message-prospection") ? "Appel téléphonique" : "");

  return `${pathname}?${params.toString()}`;
}

function bestActionCoachLine(status: string) {
  if (/Rendez-vous vendeur obtenu/i.test(status)) {
    return "Là, tu as un rendez-vous. On prépare ton analyse de marché avant d’y aller, pas après le mandat.";
  }
  if (/Mandat vendeur signé|Documents vendeur|Préparation mise en marché/i.test(status)) {
    return "Le mandat est signé. Maintenant, on récupère les documents vendeur et on prépare la mise en marché.";
  }
  if (/Appel|Prospect vendeur|Prospection/i.test(status)) {
    return "Commence par l’appel. Si ça ne répond pas, je te prépare le texto et la relance.";
  }
  return "On garde le focus sur la prochaine action concrète. Une étape claire, puis on avance.";
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-900">{children}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function CoachLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-teal-200/70 dark:bg-slate-950 dark:ring-teal-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
