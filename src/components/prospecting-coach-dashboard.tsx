"use client";

import { useMemo, useState } from "react";
import { BarChart3, BookOpen, CheckCircle2, MessageCircle, Mic, Target, Trophy, Users } from "lucide-react";

import {
  analyzeProspectingResponse,
  coachMetrics,
  coachObjectionLibrary,
  coachScenarios,
  futureCoachCapabilities,
  getCoachScenario,
  type CoachFeedback,
  type CoachScenarioId,
} from "@/lib/prospecting-coach";
import { cn } from "@/lib/utils";
import { VoiceDictationButton } from "@/components/voice-dictation-button";

export function ProspectingCoachDashboard({ initialScenario }: { initialScenario?: string }) {
  const [scenarioId, setScenarioId] = useState<CoachScenarioId>(getCoachScenario(initialScenario).id);
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const scenario = getCoachScenario(scenarioId);
  const objections = useMemo(() => coachObjectionLibrary(), []);

  function analyze() {
    setFeedback(analyzeProspectingResponse(response, scenario.id));
  }

  function appendTranscript(transcript: string) {
    setResponse((current) => [current.trim(), transcript.trim()].filter(Boolean).join(" "));
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-7">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Coach IA de prospection</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Entraînez vos conversations vendeurs</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Pratiquez vos appels, renforcez vos réponses aux objections et développez le réflexe qui mène naturellement vers un rendez-vous d&apos;évaluation.
            </p>
          </div>
          <CoachScoreCard />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={Target} label="Objectif d'appels aujourd'hui" value={coachMetrics.callGoalToday.toString()} />
        <MetricCard icon={Users} label="Prospects à contacter" value={coachMetrics.prospectsToContact.toString()} />
        <MetricCard icon={MessageCircle} label="Relances dues" value={coachMetrics.followUpsDue.toString()} />
        <MetricCard icon={Trophy} label="Objectif rendez-vous" value={coachMetrics.appointmentGoal.toString()} />
        <MetricCard icon={CheckCircle2} label="Score de discipline" value={`${coachMetrics.disciplineScore}%`} />
        <MetricCard icon={BarChart3} label="Score de conversion" value={`${coachMetrics.conversionScore}%`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Mode entraînement</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Simulation de prospection</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{scenario.difficulty}</span>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {coachScenarios.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setScenarioId(item.id);
                  setResponse("");
                  setFeedback(null);
                }}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm font-semibold transition",
                  scenario.id === item.id
                    ? "border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-50"
                    : "border-slate-200 bg-slate-50 hover:border-teal-200 dark:border-slate-800 dark:bg-slate-950/50",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Le propriétaire dit</p>
            <p className="mt-2 text-lg font-semibold leading-7">“{scenario.ownerOpening}”</p>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{scenario.context}</p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="block text-sm font-semibold" htmlFor="coach-response">
              Votre réponse
            </label>
            <VoiceDictationButton onTranscript={appendTranscript} />
          </div>
          <textarea
            id="coach-response"
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="Écrivez comme si vous étiez au téléphone avec le propriétaire..."
            className="mt-3 min-h-40 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={analyze}
            disabled={!response.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Trophy className="h-4 w-4" />
            Obtenir le feedback Coach
          </button>

          {feedback ? <FeedbackCard feedback={feedback} /> : null}
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30">
            <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">Méthode Coach</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-teal-950 dark:text-teal-50">Conversation, curiosité, rendez-vous</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-teal-900/80 dark:text-teal-100/80">
              <li>- Ouvrir avec énergie et respect.</li>
              <li>- Poser une question qui fait parler.</li>
              <li>- Créer de la curiosité autour de la valeur ou du timing.</li>
              <li>- Fermer vers un rendez-vous simple.</li>
              <li>- Relancer avec discipline sans mettre de pression.</li>
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
            <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
              <Mic className="h-4 w-4" />
              Architecture future
            </p>
            <div className="mt-4 space-y-2">
              {futureCoachCapabilities.map((item) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
          <BookOpen className="h-4 w-4" />
          Bibliothèque d&apos;objections
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Réponses prêtes à pratiquer</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {objections.map((item) => (
            <article key={item.objection} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <h3 className="text-base font-semibold">{item.objection}</h3>
              <ObjectionLine label="Courte" value={item.shortResponse} />
              <ObjectionLine label="Relationnelle" value={item.relationalResponse} />
              <ObjectionLine label="Directe" value={item.directResponse} />
              <ObjectionLine label="Question" value={item.followUpQuestion} />
              <p className="mt-3 rounded-lg bg-white p-3 text-xs font-semibold uppercase tracking-wide text-teal-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-teal-300 dark:ring-slate-800">{item.finalObjective}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CoachScoreCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Focus du jour</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">3 rendez-vous</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Objectif : ouvrir plus de conversations vendeurs et transformer les objections en prochaines étapes.</p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
      <Icon className="h-4 w-4 text-teal-600" />
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: CoachFeedback }) {
  return (
    <div className="mt-6 rounded-lg border border-teal-200 bg-teal-50/70 p-5 dark:border-teal-900 dark:bg-teal-950/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">Feedback Coach</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-teal-950 dark:text-teal-50">Score : {feedback.score}/10</h3>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-teal-700 ring-1 ring-teal-200 dark:bg-slate-950 dark:text-teal-200 dark:ring-teal-900">{feedback.score}</div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <CoachLine label="Ce qui était bon" value={feedback.good} />
        <CoachLine label="Ce qui était faible" value={feedback.weak} />
        <CoachLine label="Top vendeur" value={feedback.topSellerAnswer} />
        <CoachLine label="Prochaine meilleure question" value={feedback.nextBestQuestion} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <CheckBadge active={feedback.checks.natural} label="Naturel" />
        <CheckBadge active={feedback.checks.strongQuestion} label="Bonne question" />
        <CheckBadge active={feedback.checks.curiosity} label="Curiosité" />
        <CheckBadge active={feedback.checks.appointment} label="Rendez-vous" />
        <CheckBadge active={!feedback.checks.tooAggressive} label="Pas trop agressif" />
        <CheckBadge active={!feedback.checks.tooSoft} label="Pas trop mou" />
      </div>
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

function CheckBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", active ? "bg-white text-teal-700 ring-teal-200 dark:bg-slate-950 dark:text-teal-200 dark:ring-teal-900" : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900")}>{label}</span>
  );
}

function ObjectionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
