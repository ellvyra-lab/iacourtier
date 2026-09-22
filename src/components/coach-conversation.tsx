"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Bot, Mic, Send, X, Loader2, Plus, ArrowUpRight } from "lucide-react";
import { useDashboardAuth } from "@/components/auth/DashboardAuthProvider";
import { VoiceDictationButton } from "@/components/voice-dictation-button";
import type { CoachActionRequest, CoachMessage, CoachReply } from "@/lib/coach/conversation";

type ConversationState = { messages: CoachMessage[]; busy: boolean; error: string; send: (text: string, choiceId?: string, taskId?: string, action?: CoachActionRequest, referenceId?: string) => Promise<void>; reset: () => Promise<void>; open: boolean; setOpen: (value: boolean) => void; voice: number; consumeVoice: () => void; launch: (voice?: boolean) => void };
const ConversationContext = createContext<ConversationState | null>(null);
function useConversation() { const context = useContext(ConversationContext); if (!context) throw new Error("CoachConversationProvider requis"); return context; }
export function CoachConversationProvider({ children }: { children: ReactNode }) {
  const { user, status, authenticatedFetch } = useDashboardAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(0);
  const idRef = useRef<string | null>(null);
  const sending = useRef(false);
  const userRef = useRef(user?.id); userRef.current = user?.id;
  const storageKey = user ? `iacourtier.coach.${user.id}` : null;

  useEffect(() => {
    idRef.current = null; setMessages([]); setError("");
    if (status !== "authenticated" || !storageKey) return;
    let active = true;
    const id = sessionStorage.getItem(storageKey);
    if (id) {
      idRef.current = id;
      void authenticatedFetch(`/api/coach/conversation?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active && idRef.current === id) setMessages(previous => {
          const history = (body.messages || []) as CoachMessage[];
          return [...history, ...previous.filter(message => !history.some(stored => stored.id === message.id))];
        });
      }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Historique indisponible."); });
    }
    return () => { active = false; };
  }, [status, storageKey, authenticatedFetch]);

  const createConversation = useCallback(async () => {
    const response = await authenticatedFetch("/api/coach/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "new" }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    idRef.current = body.id;
    if (storageKey) sessionStorage.setItem(storageKey, body.id);
    return body.id as string;
  }, [authenticatedFetch, storageKey]);
  async function reset() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try { await createConversation(); setMessages([]); setVoice(0); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nouvelle conversation impossible."); }
    finally { sending.current = false; setBusy(false); }
  }
  async function send(text: string, choiceId?: string, taskId?: string, action?: CoachActionRequest, referenceId?: string) {
    if (sending.current || !text.trim()) return;
    sending.current = true; setBusy(true); setError("");
    const owner = user?.id;
    const messageId = crypto.randomUUID();
    try {
      const conversationId = idRef.current || await createConversation();
      setMessages(previous => [...previous, { id: messageId, text, reply: null }]);
      const response = await authenticatedFetch("/api/coach/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, messageId, text, choiceId, taskId, action, referenceId }) });
      const body = await response.json();
      if (owner !== userRef.current) return;
      if (!response.ok) throw new Error(body.error || "La demande n’a pas pu être terminée.");
      const result = body as CoachReply;
      setMessages(previous => previous.map(message => message.id === messageId ? { ...message, reply: result } : message));
      if (result.changed) { window.dispatchEvent(new Event("crm-updated")); router.refresh(); }
      if (result.navigate) { setOpen(true); router.push(result.navigate); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Connexion interrompue. Vérifie le CRM avant de répéter l’action."); }
    finally { sending.current = false; setBusy(false); }
  }
  function launch(withVoice = false) { setOpen(true); if (withVoice) setVoice(current => current + 1); }
  const isCoachPage = pathname === "/tableau-de-bord" || pathname === "/tableau-de-bord/coach";
  return <ConversationContext.Provider value={{ messages, busy, error, send, reset, open, setOpen, voice, consumeVoice: () => setVoice(0), launch }}>
    {children}
    {open && !isCoachPage ? <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/50" onClick={() => setOpen(false)}><section role="dialog" aria-modal="true" aria-label="Coach IA" className="h-[100dvh] w-full max-w-xl bg-white shadow-2xl dark:bg-slate-950" onClick={event => event.stopPropagation()}><CoachConversation panel /></section></div> : null}
  </ConversationContext.Provider>;
}

export function CoachLauncher({ floating = false }: { floating?: boolean }) {
  const { launch, open } = useConversation();
  const pathname = usePathname();
  if (floating && (open || pathname === "/tableau-de-bord" || pathname === "/tableau-de-bord/coach")) return null;
  return <div className={floating ? "fixed bottom-5 right-4 z-50 flex items-center gap-2" : "flex flex-wrap gap-3"}>
    <button type="button" onClick={() => launch()} className="min-h-12 rounded-full border border-slate-200 bg-white px-5 font-semibold text-slate-900 shadow-lg"><Bot className="mr-2 inline h-5 w-5" />Coach IA</button>
    <button type="button" onClick={() => launch(true)} className="flex min-h-14 items-center gap-2 rounded-full bg-red-600 px-5 font-bold text-white shadow-lg" aria-label="Dire à IACourtier"><Mic className="h-6 w-6" /><span className="text-sm">Dire à IACourtier</span></button>
  </div>;
}

export function CoachConversation({ panel = false }: { panel?: boolean }) {
  const { messages, busy, error, send, reset, setOpen, voice, consumeVoice } = useConversation();
  const { user } = useDashboardAuth();
  const [text, setText] = useState("");
  const [availableHeight, setAvailableHeight] = useState<number>();
  const container = useRef<HTMLElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const name = typeof user?.user_metadata?.first_name === "string" ? user.user_metadata.first_name : "";
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);
  useEffect(() => {
    const resize = () => {
      const view = window.visualViewport;
      const top = Math.max(0, (container.current?.getBoundingClientRect().top || 0) - (view?.offsetTop || 0));
      setAvailableHeight(Math.max(260, (view?.height || window.innerHeight) - top - (panel ? 0 : 16)));
    };
    resize(); window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, [panel]);
  async function submit(value = text, choiceId?: string, taskId?: string) { if (!value.trim() || busy) return; setText(""); consumeVoice(); await send(value, choiceId, taskId); }
  return <section ref={container} style={availableHeight ? { height: availableHeight } : undefined} className={`mx-auto flex w-full max-w-4xl flex-col ${panel ? "h-full" : "h-[calc(100dvh-10rem)]"}`} aria-label="Conversation avec le Coach IA" onKeyDown={event => { if (panel && event.key === "Escape") setOpen(false); }}>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-4 dark:border-slate-800"><div className="flex items-center gap-3"><span className="rounded-2xl bg-blue-50 p-3 text-blue-700"><Bot /></span><div><h1 className="text-xl font-semibold">Coach IA</h1><p className="text-xs text-slate-500">Ton assistant immobilier</p></div></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void reset()} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50" title="Nouvelle conversation, sans ancien contexte"><Plus className="inline h-4 w-4" /><span className="hidden sm:inline"> Nouvelle conversation</span></button>{panel ? <button type="button" onClick={() => setOpen(false)} className="min-h-11 min-w-11 rounded-xl border" aria-label="Fermer le Coach"><X className="mx-auto h-5 w-5" /></button> : <Link className="hidden rounded-xl px-3 py-3 text-sm text-blue-700 sm:block" href="/tableau-de-bord/accueil">Vue d’ensemble</Link>}</div></header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6" role="log" aria-live="polite" aria-relevant="additions">
      {!messages.length ? <div className="mx-auto max-w-xl py-8"><p className="text-2xl font-semibold">Bonjour{name ? ` ${name}` : ""}.</p><p className="mt-2 text-xl text-slate-500">Qu’est-ce qu’on fait aujourd’hui ?</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{["☀️ Mon topo", "À quoi dois-je répondre ?", "Montre-moi ma journée.", "Trouve un client."].map(suggestion => <button type="button" disabled={busy} key={suggestion} onClick={() => { if (suggestion === "Trouve un client." || suggestion === "Ajoute une tâche.") setText(suggestion === "Trouve un client." ? "Trouve " : "Rappelle-moi de "); else void submit(suggestion); }} className="min-h-14 rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-400 dark:border-slate-800">{suggestion}</button>)}</div></div> : messages.map((message, index) => <div key={message.id} className="mb-6 space-y-4"><div className="ml-auto max-w-[88%] whitespace-pre-wrap break-words rounded-2xl bg-blue-600 px-4 py-3 text-white">{message.text}</div>{message.reply ? <div className="max-w-full space-y-3"><p className="whitespace-pre-wrap break-words leading-relaxed">{message.reply.text}</p>{message.reply.cards.map(card => <div key={`${card.kind}-${card.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="min-w-0"><Link href={card.href} onClick={event => { if (card.kind === "email" || card.kind === "event") { event.preventDefault(); void send(`Voir : ${card.title}`,undefined,undefined,undefined,card.id); } }} className="break-words font-semibold text-blue-700">{card.title}<ArrowUpRight className="ml-1 inline h-4 w-4" /></Link>{card.detail ? <p className="mt-1 text-sm text-slate-500">{card.detail}</p> : null}</div>{card.phone ? <a href={`tel:${card.phone.replace(/[^+\d]/g, "")}`} className="shrink-0 rounded-xl border px-3 py-3 text-sm">Appeler</a> : null}{card.kind === "task" ? <button disabled={busy} className="shrink-0 rounded-xl border px-3 py-3 text-sm" onClick={() => void submit(`Marque la tâche « ${card.title} » comme faite.`, undefined, card.id)}>Terminer</button> : null}</div>)}{message.reply.choices && index === messages.length - 1 ? <div className="grid gap-2">{message.reply.choices.map(choice => <button disabled={busy} type="button" key={choice.id} onClick={() => void submit(choice.label, choice.id)} className="min-h-12 rounded-xl border border-blue-300 px-4 py-3 text-left">{choice.label}</button>)}</div> : null}{message.reply.approval && !message.reply.draft ? <Approval approval={message.reply.approval} active={index === messages.length - 1} /> : null}{message.reply.draft ? <EmailDraft draft={message.reply.draft} approval={message.reply.approval} active={index === messages.length - 1} /> : null}</div> : null}</div>)}
      {busy ? <p className="flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" />Le Coach travaille…</p> : null}<div ref={bottom} />
    </div>
    <footer className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-950">
      {error ? <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}><label className="sr-only" htmlFor={panel ? "coach-panel-text" : "coach-text"}>Ton message</label><textarea id={panel ? "coach-panel-text" : "coach-text"} value={text} onChange={event => setText(event.target.value)} maxLength={12000} rows={2} placeholder="Écrire un message…" disabled={busy} className="min-h-14 min-w-0 flex-1 resize-none rounded-2xl border border-slate-300 bg-transparent p-3 text-base" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} /><button type="submit" aria-label="Envoyer" disabled={busy || !text.trim()} className="flex min-h-14 min-w-14 items-center justify-center rounded-2xl bg-blue-600 text-white disabled:opacity-40"><Send className="h-5 w-5" /></button></form>
      <div className="mt-3">{!busy ? <VoiceDictationButton key={`${voice}-${messages.length}`} autoStart={voice > 0} onTranscript={value => void submit(value)} onLiveTranscript={setText} label="Parler à IACourtier" large /> : null}</div>
    </footer>
  </section>;
}
function EmailDraft({ draft, approval, active }: { draft: NonNullable<CoachReply["draft"]>; approval?: CoachReply["approval"]; active: boolean }) {
  const { send, busy } = useConversation();
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.message);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const dirty = subject !== draft.subject || message !== draft.message;
  return <div className="space-y-3 rounded-2xl border border-slate-200 p-4"><p className="break-words text-sm">Destinataire : {draft.recipient}</p><label className="block text-sm">Objet<input aria-label="Objet du brouillon" readOnly={!editing || !active} value={subject} maxLength={200} onChange={event => setSubject(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-base" /></label><textarea aria-label="Message du brouillon" readOnly={!editing || !active} value={message} maxLength={12000} onChange={event => setMessage(event.target.value)} rows={8} className="w-full rounded-xl border bg-transparent p-3 text-base" /><div className="flex flex-wrap gap-2"><button type="button" disabled={!active || busy} onClick={() => setEditing(value => !value)} className="min-h-11 rounded-xl border px-4">{editing ? "Terminer" : "Modifier"}</button>{approval && active ? <><button type="button" disabled={busy || !subject.trim() || !message.trim()} className="min-h-11 rounded-xl bg-blue-600 px-4 text-white disabled:opacity-40" onClick={() => void send(dirty ? "Enregistrer le brouillon modifié." : "Envoyer le courriel présenté.",undefined,undefined,{ id:approval.id,mode:dirty ? "edit" : "confirm",...(dirty ? { subject,message } : {}) })}>{dirty ? "Enregistrer l’aperçu" : "Envoyer"}</button><button type="button" disabled={busy} className="min-h-11 rounded-xl border px-4" onClick={() => void send("Annuler le brouillon.",undefined,undefined,{ id:approval.id,mode:"cancel" })}>Annuler</button></> : null}<button type="button" className="min-h-11 rounded-xl border px-4" onClick={() => { void navigator.clipboard.writeText(`À : ${draft.recipient}\nObjet : ${subject}\n\n${message}`).then(() => setNotice("Copié.")).catch(() => setNotice("Copie indisponible. Sélectionne le texte manuellement.")); }}>Copier</button></div><p role="status" className="text-xs text-slate-500">{notice || (active ? "Aucun envoi avant confirmation. Les modifications doivent être enregistrées dans un nouvel aperçu." : "Aperçu précédent — utilise la dernière réponse du Coach.")}</p></div>;
}

function Approval({ approval, active }: { approval: NonNullable<CoachReply["approval"]>; active: boolean }) {
  const { send,busy } = useConversation();
  return active ? <div className="flex flex-wrap gap-2"><button disabled={busy} className="min-h-12 rounded-xl bg-blue-600 px-4 text-white" onClick={() => void send(approval.label,undefined,undefined,{ id:approval.id,mode:"confirm" })}>{approval.label}</button><button disabled={busy} className="min-h-12 rounded-xl border px-4" onClick={() => void send("Annuler cet aperçu.",undefined,undefined,{ id:approval.id,mode:"cancel" })}>Annuler</button></div> : null;
}

export function CoachTaskActions({ id, title, completed }: { id: string; title: string; completed: boolean }) {
  const { send, busy, launch } = useConversation();
  return <button type="button" disabled={completed || busy} onClick={() => { launch(); void send(`Marque « ${title} » comme faite.`, undefined, id); }} className="min-h-12 rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:opacity-50">{completed ? "Terminée" : "Marquer comme faite"}</button>;
}
