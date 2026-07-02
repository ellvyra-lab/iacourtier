"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Mail, MessageCircle, Phone, Plus, RotateCcw, Save, Sparkles } from "lucide-react";

import { analyzeCallTranscript, createCallCoachFeedback, type CallAnalysis } from "@/lib/call-intelligence";
import { contextFromPipelineStatus, getContextualAiActions } from "@/lib/ai-actions";
import { addProspectHistory, getSoniaProspect, recordCallResult, updateProspectStatus, updateSoniaProspect, type CallResult, type SoniaProspect } from "@/lib/sonia-beta";
import { officialSellerWorkflow } from "@/lib/business-rules";
import { cn } from "@/lib/utils";
import { VoiceDictationButton } from "@/components/voice-dictation-button";

const callResults: Array<{ id: CallResult; label: string }> = [
  { id: "pas_repondu", label: "Pas répondu" },
  { id: "mauvais_numero", label: "Mauvais numéro" },
  { id: "interesse", label: "Intéressé" },
  { id: "rendez_vous_obtenu", label: "Rendez-vous obtenu" },
  { id: "a_rappeler", label: "À rappeler plus tard" },
  { id: "pas_interesse", label: "Pas intéressé" },
  { id: "deja_avec_courtier", label: "Vendu / déjà avec courtier" },
];

export function ProspectDetail({ id, demoCall = false }: { id: string; demoCall?: boolean }) {
  const [prospect, setProspect] = useState<SoniaProspect | null>(null);
  const [callStarted, setCallStarted] = useState(false);
  const [callResult, setCallResult] = useState<CallResult>("pas_repondu");
  const [callNote, setCallNote] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [followupDate, setFollowupDate] = useState("");
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

  async function startCall() {
    if (!prospect) return;
    setCallStarted(true);
    setCallStatus("Préparation de l'appel...");
    const updated = addProspectHistory(prospect.id, {
      title: "Appel lancé avec IACourtier",
      description: prospect.phone ? `Mode bêta : ouverture du téléphone pour ${prospect.phone}.` : "Mode démo : aucun numéro disponible, appel simulé créé.",
      type: "call",
    });
    refresh(updated);
    if (!prospect.phone) {
      setCallStatus("Mode démo : aucun numéro disponible. Notez le résultat de l'appel simulé.");
      return;
    }

    try {
      const response = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: prospect.phone, prospectId: prospect.id, recordingEnabled: true, provider: "twilio" }),
      });
      const payload = (await response.json()) as { message?: string; error?: string; mode?: string };
      setCallStatus(payload.error || payload.message || "Appel lancé.");
      if (!response.ok || payload.mode === "demo") window.location.href = `tel:${prospect.phone}`;
    } catch {
      setCallStatus("Mode démo : ouverture du téléphone de l'appareil.");
      window.location.href = `tel:${prospect.phone}`;
    }
  }

  function saveCallResult() {
    if (!prospect) return;
    const updated = recordCallResult(prospect.id, callResult, callNote, callbackDate);
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

  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Fiche prospect / client</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{prospect.name}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{prospect.address}, {prospect.city}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{prospect.status}</Badge>
              <Badge>{prospect.clientType === "seller" ? "Vendeur" : "Acheteur"}</Badge>
              <Badge>Source : {prospect.source}</Badge>
            </div>
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
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button onClick={startCall} type="button" className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
                <Phone className="h-4 w-4" />
                Appeler avec IACourtier
              </button>
              <a href={prospect.phone ? `sms:${prospect.phone}` : undefined} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-950">
                <MessageCircle className="h-4 w-4" />
                Envoyer texto
              </a>
              <a href={prospect.email ? `mailto:${prospect.email}` : undefined} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-950">
                <Mail className="h-4 w-4" />
                Préparer courriel
              </a>
              <button onClick={markAppointmentObtained} type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
                <CalendarPlus className="h-4 w-4" />
                Marquer rendez-vous obtenu
              </button>
              <button onClick={markMandateSigned} type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                <Save className="h-4 w-4" />
                Mandat signé
              </button>
            </div>
            {callStatus ? <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">{callStatus}</p> : null}
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-sm font-semibold">Planifier relance</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input type="date" value={followupDate} onChange={(event) => setFollowupDate(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" />
                <button onClick={planFollowup} type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900">
                  <CalendarPlus className="h-4 w-4" />
                  Planifier relance
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <h2 className="text-lg font-semibold">Résultat de l&apos;appel</h2>
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
            {callResult === "a_rappeler" ? (
              <label className="mt-4 block text-sm font-semibold">
                Date de rappel
                <input type="date" value={callbackDate} onChange={(event) => setCallbackDate(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" />
              </label>
            ) : null}
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
            <button onClick={saveCallResult} type="button" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
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
