"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Plus, Send } from "lucide-react";

import { INFORMATION_REQUEST_NEXT_ACTION } from "@/lib/sonia-beta/storage";
import type { SoniaBattlePlan, SoniaProspect } from "@/lib/sonia-beta";
import type { DirectorAction } from "@/app/api/coach/director/route";

type DirectorTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: DirectorAction;
  secondaryActions?: DirectorAction[];
};

type DirectorConversation = {
  id: string;
  title: string;
  createdAt: string;
  turns: DirectorTurn[];
};

const CONVERSATIONS_KEY = "iacourtier_director_conversations";
const ACTIVE_ID_KEY = "iacourtier_director_active_conversation";

function loadConversations(): DirectorConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations: DirectorConversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations.slice(-100)));
}

function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ID_KEY);
}

function saveActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_ID_KEY, id);
  else window.localStorage.removeItem(ACTIVE_ID_KEY);
}

function buildTitle(message: string): string {
  const cleaned = message.trim().replace(/\s+/g, " ");
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Aujourd'hui";
  if (sameDay(date, yesterday)) return "Hier";
  return date.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
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
  const [conversations, setConversations] = useState<DirectorConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [turns, setTurns] = useState<DirectorTurn[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVoiceHint, setShowVoiceHint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadedConversations = loadConversations();
    setConversations(loadedConversations);

    const savedActiveId = loadActiveId();
    const active = savedActiveId ? loadedConversations.find((conversation) => conversation.id === savedActiveId) : undefined;
    if (active) {
      setActiveId(active.id);
      setTurns(active.turns);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  const groupedConversations = useMemo(() => {
    const sorted = [...conversations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const groups: { label: string; items: DirectorConversation[] }[] = [];

    for (const conversation of sorted) {
      const label = formatDayLabel(conversation.createdAt);
      const group = groups.find((entry) => entry.label === label);
      if (group) {
        group.items.push(conversation);
      } else {
        groups.push({ label, items: [conversation] });
      }
    }

    return groups;
  }, [conversations]);

  function persistConversation(id: string, title: string, createdAt: string, turnsToSave: DirectorTurn[]) {
    setConversations((current) => {
      const existingIndex = current.findIndex((conversation) => conversation.id === id);
      const record: DirectorConversation = { id, title, createdAt, turns: turnsToSave };
      const next = existingIndex >= 0 ? current.map((conversation, index) => (index === existingIndex ? record : conversation)) : [record, ...current];
      saveConversations(next);
      return next;
    });
    saveActiveId(id);
  }

  function startNewConversation() {
    setActiveId(null);
    setTurns([]);
    setError(null);
    setIsHistoryOpen(false);
    saveActiveId(null);
  }

  function openConversation(id: string) {
    const conversation = conversations.find((entry) => entry.id === id);
    if (!conversation) return;
    setActiveId(conversation.id);
    setTurns(conversation.turns);
    setError(null);
    setIsHistoryOpen(false);
    saveActiveId(conversation.id);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) return;

    const userTurn: DirectorTurn = { id: `user-${Date.now()}`, role: "user", content: message };
    const turnsWithUser = [...turns, userTurn];
    setTurns(turnsWithUser);
    setInput("");
    setError(null);
    setIsSending(true);

    const existing = activeId ? conversations.find((conversation) => conversation.id === activeId) : undefined;
    const conversationId = existing?.id || `conv-${Date.now()}`;
    const conversationTitle = existing?.title || buildTitle(message);
    const conversationCreatedAt = existing?.createdAt || new Date().toISOString();

    persistConversation(conversationId, conversationTitle, conversationCreatedAt, turnsWithUser);
    if (!existing) setActiveId(conversationId);

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

      const data = (await res.json()) as { reply: string; action: DirectorAction; secondaryActions: DirectorAction[] };
      const directorTurn: DirectorTurn = {
        id: `director-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        action: data.action,
        secondaryActions: data.secondaryActions,
      };
      const updatedTurns = [...turnsWithUser, directorTurn];
      setTurns(updatedTurns);
      persistConversation(conversationId, conversationTitle, conversationCreatedAt, updatedTurns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le Directeur IA n'a pas pu répondre.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-electric-500">Conversation avec le Directeur IA</p>
          <p className="mt-1 text-xs text-muted">
            Pose une question ou décris une situation. Il répond comme un directeur d&apos;agence, pas comme un chatbot général.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startNewConversation}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-subtle bg-background px-3 py-2 text-xs font-semibold transition hover:border-electric-500/40"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle conversation
          </button>
          <button
            type="button"
            onClick={() => setIsHistoryOpen((current) => !current)}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-subtle bg-background px-3 py-2 text-xs font-semibold transition hover:border-electric-500/40"
          >
            Historique
          </button>
        </div>
      </div>

      {isHistoryOpen ? (
        <div className="mt-3 max-h-56 space-y-3 overflow-y-auto rounded-2xl border border-subtle bg-background p-3">
          {groupedConversations.length === 0 ? (
            <p className="text-xs text-muted">Aucune conversation précédente.</p>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</p>
                <div className="mt-1 space-y-1">
                  {group.items.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => openConversation(conversation.id)}
                      className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface-soft ${
                        conversation.id === activeId ? "bg-surface-soft font-semibold text-electric-500" : "text-foreground"
                      }`}
                    >
                      {conversation.title || "Nouvelle conversation"}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

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

              {turn.action ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href={turn.action.href}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-electric-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-electric-600"
                  >
                    {turn.action.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {turn.secondaryActions?.map((secondary) => (
                    <Link
                      key={secondary.href}
                      href={secondary.href}
                      className="text-xs font-medium text-muted underline-offset-2 hover:text-electric-500 hover:underline"
                    >
                      {secondary.label}
                    </Link>
                  ))}
                </div>
              ) : null}
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
