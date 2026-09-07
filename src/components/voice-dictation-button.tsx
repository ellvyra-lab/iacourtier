"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

import { cn } from "@/lib/utils";

type DictationState = "idle" | "listening" | "transcribing" | "error";
type SpeechRecognitionResultLike = { readonly length: number; readonly isFinal?: boolean; item(index: number): { transcript: string }; [index: number]: { transcript: string } };
type SpeechRecognitionEventLike = Event & { resultIndex: number; results: { readonly length: number; item(index: number): SpeechRecognitionResultLike; [index: number]: SpeechRecognitionResultLike } };
type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; onstart: (() => void) | null; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

export function VoiceDictationButton({ onTranscript, onLiveTranscript, onStateChange, className, label = "🎙️ Répondre à voix haute", stopLabel = "TERMINER", autoStart = false, large = false }: {
  onTranscript: (transcript: string) => void;
  onLiveTranscript?: (transcript: string) => void;
  onStateChange?: (state: DictationState) => void;
  className?: string;
  label?: string;
  stopLabel?: string;
  autoStart?: boolean;
  large?: boolean;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const autoStartedRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onLiveTranscriptRef = useRef(onLiveTranscript);
  const [state, setState] = useState<DictationState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => { onTranscriptRef.current = onTranscript; onLiveTranscriptRef.current = onLiveTranscript; }, [onLiveTranscript, onTranscript]);

  const changeState = useCallback((next: DictationState) => { setState(next); onStateChange?.(next); }, [onStateChange]);
  const startDictation = useCallback(() => {
    if (typeof window === "undefined" || recognitionRef.current) return;
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) { changeState("error"); setMessage("La reconnaissance vocale n’est pas disponible ici. Tu peux écrire la note ci-dessous."); return; }
    const recognition = new Recognition();
    transcriptRef.current = "";
    recognition.lang = "fr-CA";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => { changeState("listening"); setMessage("Je vous écoute…"); };
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results.item(index).item(0).transcript).join(" ").trim();
      transcriptRef.current = transcript;
      onLiveTranscriptRef.current?.(transcript);
    };
    recognition.onerror = () => { recognitionRef.current = null; changeState("error"); setMessage("Le micro n’a pas pu démarrer. Vérifie la permission du navigateur."); };
    recognition.onend = () => {
      recognitionRef.current = null;
      const transcript = transcriptRef.current.trim();
      if (transcript) { changeState("transcribing"); setMessage("Transcription terminée. IACourtier organise le CRM…"); onTranscriptRef.current(transcript); }
      else { changeState("idle"); setMessage("Aucune parole détectée. Tu peux recommencer."); }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { recognitionRef.current = null; changeState("error"); setMessage("Le micro n’a pas pu démarrer."); }
  }, [changeState]);

  useEffect(() => {
    if (autoStart && !autoStartedRef.current) { autoStartedRef.current = true; startDictation(); }
    return () => { const recognition = recognitionRef.current; if (recognition) { recognition.onend = null; recognition.stop(); } recognitionRef.current = null; };
  }, [autoStart, startDictation]);

  function stopDictation() { recognitionRef.current?.stop(); changeState("transcribing"); setMessage("Transcription…"); }
  const isListening = state === "listening";
  return <div className={cn("flex flex-col items-stretch gap-2", className)}>
    <button type="button" onClick={isListening ? stopDictation : startDictation} disabled={state === "transcribing"} className={cn("inline-flex items-center justify-center gap-3 rounded-2xl border font-bold transition disabled:opacity-60", large ? "min-h-16 px-6 text-base" : "px-3 py-2 text-xs", isListening ? "border-red-700 bg-red-600 text-white shadow-lg shadow-red-600/25 hover:bg-red-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200")}>
      {isListening ? <Square className={large ? "h-6 w-6" : "h-3.5 w-3.5"} /> : <Mic className={large ? "h-6 w-6" : "h-3.5 w-3.5"} />}
      {isListening ? stopLabel : state === "transcribing" ? "TRAITEMENT…" : state === "error" ? "RÉESSAYER LE MICRO" : label}
    </button>
    {message ? <p aria-live="polite" className={cn("text-center text-xs", state === "error" ? "text-red-600 dark:text-red-300" : "text-slate-500 dark:text-slate-400")}>{message}</p> : null}
  </div>;
}

