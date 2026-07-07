"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";

import { INFORMATION_REQUEST_NEXT_ACTION } from "@/lib/sonia-beta/storage";
import type { SoniaBattlePlan, SoniaProspect } from "@/lib/sonia-beta";

type DirectorTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const storageKey = () => `iacourtier_director_conversation_${todayKey()}`;

function loadTurns(): DirectorTurn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTurns(turns: DirectorTurn[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(turns.slice(-40)));
}

export function DirectorChatPanel({
  prospects,
  plan,
  userName = "Sonia",
}: {
  prospects: SoniaProspect[];
  plan: SoniaBattlePlan;
  userName?: string;
}) {
  const [turns, setTurns] = useState<DirectorTurn[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVoiceHint, setShowVoiceHint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTurns(loadTurns());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) return;

    const userTurn: DirectorTurn = { id: `user-${Date.now()}`, role: "user", content: message };
    const turnsWithUser = [...turns, userTurn];
    setTurns(turnsWithUser);
    saveTurns(turnsWithUser);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const realProspects = prospects.filter((prospect) => !prospect.id.startsWith("sonia-demo-"));
      const informationRequests = realProspects.filter((prospect) => prospect.nextAction === INFORMATION_REQUEST_NEXT_ACTION);

      const res = await fetch("/api/coach/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: turnsWithUser.slice(-8).map((turn) => ({ role: turn.role, content: turn.content })),
          context: {
            userName,
            informationRequests: informationRequests.length,
            informationRequestExample: informationRequests[0]
              ? { name: informationRequests[0].name, address: informationRequests[0].address }
              : null,
            sellerAppointmentsToPrepare: plan.sellerAppointmentsToPrepare.length,
            followupsDue: plan.followupsDue.length,
            marketAnalysesToPrepare: plan.marketAnalysesToPrepare.length,
            radarProspectsToCall: plan.radarProspectsToCall.length,
            callsToMake: plan.callsToMake.length,
            mandatesWithMissingDocuments: plan.mandatesWithMissingDocuments.length,
            marketingActionsToGenerate: plan.marketingActionsToGenerate.length,
            totalProspects: realProspects.length,
          },
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Le Directeur IA n'a pas pu répondre.");
      }

      const data = (await res.json()) as { reply: string };
      const directorTurn: DirectorTurn = { id: `director-${Date.now()}`, role: "assistant", content: data.reply };
      setTurns((current) => {
        const updated = [...current, directorTurn];
        saveTurns(updated);
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le Directeur IA n'a pas pu répondre.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-subtle bg-surface p-5">
      <p className="text-sm font-semibold text-electric-500">Conversation avec le Directeur IA</p>
      <p className="mt-1 text-xs text-muted">
        Pose une question ou décris une situation. Il répond comme un directeur d&apos;agence, pas comme un chatbot général.
      </p>

      <div ref={scrollRef} className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
        {turns.length === 0 ? (
          <p className="text-sm text-muted">
            Exemples : « Qu&apos;est-ce qui est le plus important aujourd&apos;hui ? », « Je viens de recevoir une demande Facebook. », « Je veux
            prospecter. »
          </p>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={`rounded-2xl border p-3 text-sm leading-6 ${
                turn.role === "user" ? "border-subtle bg-background text-foreground" : "border-electric-500/30 bg-electric-500/5 text-foreground"
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{turn.role === "user" ? userName : "Directeur IA"}</p>
              <p className="whitespace-pre-line">{turn.content}</p>
            </div>
          ))
        )}
        {isSending ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Le Directeur IA réfléchit...
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
          ⚠️ {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Écris au Directeur IA..."
          disabled={isSending}
          className="flex-1 rounded-2xl border border-subtle bg-background px-4 py-3 text-sm focus:border-electric-500/40 focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setShowVoiceHint(true)}
          aria-label="Entrée vocale (bientôt disponible)"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-subtle bg-background px-4 py-3 text-sm transition hover:border-electric-500/40"
        >
          🎙️
        </button>
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-electric-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-electric-600 disabled:opacity-50"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {showVoiceHint ? <p className="mt-2 text-xs text-muted">Entrée vocale bientôt disponible.</p> : null}
    </section>
  );
}
