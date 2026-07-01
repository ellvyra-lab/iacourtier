"use client";

import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, FileAudio, Loader2, Mic, Phone, ShieldCheck, Zap } from "lucide-react";

import { analyzeCallTranscript, createCallCoachFeedback, createCallFollowupRecommendation, type CallAnalysis } from "@/lib/call-intelligence";
import { cn } from "@/lib/utils";
import { VoiceDictationButton } from "@/components/voice-dictation-button";

const demoCalls = [
  { id: "call-1", name: "Mme Gagnon", status: "Analysé", score: 8, objection: "Je vais attendre" },
  { id: "call-2", name: "M. Tremblay", status: "Terminé", score: 0, objection: "Envoyez-moi ça par courriel" },
  { id: "call-3", name: "Famille Bouchard", status: "En cours", score: 0, objection: "" },
];

const sampleTranscript = `Courtier: Bonjour M. Tremblay, ici Sonia, courtière immobilière. Est-ce que vendre votre propriété cette année fait partie de vos réflexions, ou pas du tout?
Client: On n'est pas pressés, on va probablement attendre.
Courtier: Je comprends. Qu'est-ce qui vous ferait dire que le moment est bon pour regarder vos options?
Client: Si les prix montent encore un peu, peut-être.
Courtier: Parfait. Seriez-vous ouvert à un appel de 10 minutes cette semaine pour regarder votre valeur actuelle et vos options?`;

export function CallIntelligenceDashboard() {
  const [transcript, setTranscript] = useState(sampleTranscript);
  const [callMessage, setCallMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const coaching = useMemo(() => (analysis ? createCallCoachFeedback(analysis) : null), [analysis]);
  const followup = useMemo(() => (analysis ? createCallFollowupRecommendation(analysis) : null), [analysis]);

  function appendTranscript(transcriptText: string) {
    setTranscript((current) => [current.trim(), transcriptText.trim()].filter(Boolean).join("\n"));
  }

  function analyze() {
    setIsAnalyzing(true);
    window.setTimeout(() => {
      setAnalysis(
        analyzeCallTranscript({
          id: `manual-${Date.now()}`,
          transcript,
          duration: 420,
        }),
      );
      setIsAnalyzing(false);
    }, 450);
  }

  async function startDemoCall() {
    setCallMessage("Assurez-vous d'avoir les consentements requis pour enregistrer et analyser cet appel.");
    const response = await fetch("/api/calls/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "+15145550123", prospectId: "demo-prospect", recordingEnabled: true, provider: "twilio" }),
    });
    const payload = (await response.json()) as { message?: string; error?: string };
    setCallMessage(payload.error || payload.message || "Appel lancé.");
  }

  async function simulateCallEnded() {
    setIsAnalyzing(true);
    const response = await fetch("/api/calls/webhook?provider=twilio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        CallSid: "DEMO-CALL-ENDED",
        CallStatus: "completed",
        CallDuration: "420",
        TranscriptionText: transcript,
      }),
    });
    const payload = (await response.json()) as { analysis?: CallAnalysis; followup?: { timelineNote?: string } };
    if (payload.analysis) setAnalysis(payload.analysis);
    if (payload.followup?.timelineNote) setCallMessage(payload.followup.timelineNote);
    setIsAnalyzing(false);
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-7">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Call Intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Mes appels</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Lancez des appels depuis IACourtier. Quand le provider envoie l&apos;événement de fin d&apos;appel, la transcription, l&apos;analyse Coach, la note client et la relance sont préparées automatiquement.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Conformité
            </p>
            <p className="mt-2">Avant d&apos;enregistrer ou d&apos;analyser un appel, assurez-vous d&apos;avoir les consentements requis et de respecter les lois applicables.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={Phone} label="Appels en cours" value="1" />
        <Metric icon={CheckCircle2} label="Appels terminés" value="7" />
        <Metric icon={BarChart3} label="Appels analysés" value="5" />
        <Metric icon={BarChart3} label="Score moyen" value="7.6/10" />
        <Metric icon={Mic} label="Objections fréquentes" value="3" />
        <Metric icon={CheckCircle2} label="Rendez-vous demandés" value="4" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Workflow automatique</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Click-to-call puis analyse Coach</h2>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-900">Mode démo si Twilio absent</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={startDemoCall}
              className="flex min-h-28 flex-col justify-between rounded-lg border border-teal-200 bg-teal-50 p-4 text-left transition hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/30 dark:hover:bg-teal-950/50"
            >
              <Phone className="h-5 w-5 text-teal-700 dark:text-teal-200" />
              <span className="text-sm font-semibold text-teal-950 dark:text-teal-50">Démarrer un appel IACourtier</span>
              <span className="text-xs text-teal-900/70 dark:text-teal-100/70">Twilio si configuré, sinon mode démo.</span>
            </button>
            <button
              type="button"
              onClick={simulateCallEnded}
              disabled={isAnalyzing}
              className="flex min-h-28 flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-white disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-teal-900"
            >
              {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin text-teal-600" /> : <Zap className="h-5 w-5 text-teal-600" />}
              <span className="text-sm font-semibold">Simuler call ended</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Déclenche transcription, analyse, note et relance.</span>
            </button>
          </div>
          {callMessage ? <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">{callMessage}</p> : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="block text-sm font-semibold" htmlFor="call-transcript">
              Transcription reçue du provider ou collée pour test V1
            </label>
            <VoiceDictationButton onTranscript={appendTranscript} />
          </div>
          <textarea
            id="call-transcript"
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            className="mt-3 min-h-64 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={analyze}
            disabled={!transcript.trim() || isAnalyzing}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Analyser l&apos;appel
          </button>

          {analysis && coaching && followup ? <AnalysisResult analysis={analysis} coaching={coaching} followup={followup} /> : null}
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Click-to-call</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Providers prêts</h2>
            <div className="mt-4 space-y-2">
              {["Twilio", "Aircall", "RingCentral", "Dialpad", "Application mobile IACourtier"].map((provider) => (
                <div key={provider} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
                  <span>{provider}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">prévu</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Appels récents</p>
            <div className="mt-4 space-y-3">
              {demoCalls.map((call) => (
                <div key={call.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{call.name}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">{call.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{call.objection || "Conversation en cours"}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <Icon className="h-4 w-4 text-teal-600" />
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function AnalysisResult({ analysis, coaching, followup }: { analysis: CallAnalysis; coaching: ReturnType<typeof createCallCoachFeedback>; followup: ReturnType<typeof createCallFollowupRecommendation> }) {
  return (
    <div className="mt-6 rounded-lg border border-teal-200 bg-teal-50/70 p-5 dark:border-teal-900 dark:bg-teal-950/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">Résultat Coach</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-teal-950 dark:text-teal-50">Score global : {analysis.globalScore}/10</h3>
        </div>
        <FileAudio className="h-8 w-8 text-teal-700 dark:text-teal-200" />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Score label="Découverte" value={analysis.scoreDiscovery} />
        <Score label="Connexion" value={analysis.scoreConnection} />
        <Score label="Objections" value={analysis.scoreObjectionHandling} />
        <Score label="Closing" value={analysis.scoreClosing} />
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <CoachLine label="Résumé de l'appel" value={analysis.summary} />
        <CoachLine label="Ce qui était bon" value={coaching.good} />
        <CoachLine label="À améliorer" value={coaching.improve} />
        <CoachLine label="Top vendeur aurait demandé" value={coaching.topSellerQuestion} />
        <CoachLine label="Prochaine relance" value={coaching.nextFollowup} />
        <CoachLine label="Objectif prochain appel" value={coaching.nextCallGoal} />
        <CoachLine label="Action Pipeline proposée" value={`${followup.followupTask} · ${followup.nextAction}`} />
        <CoachLine label="Note ajoutée à la fiche client" value={analysis.clientNote} />
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-3 text-center ring-1 ring-teal-200 dark:bg-slate-950 dark:ring-teal-900">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function CoachLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 ring-1 ring-teal-200/70 dark:bg-slate-950 dark:ring-teal-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
