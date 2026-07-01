"use client";

import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

import { cn } from "@/lib/utils";

type DictationState = "idle" | "listening" | "transcribing" | "error";

type SpeechRecognitionResultLike = {
  readonly length: number;
  item(index: number): { transcript: string };
  [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    readonly length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function VoiceDictationButton({
  onTranscript,
  className,
  label = "🎙️ Répondre à voix haute",
}: {
  onTranscript: (transcript: string) => void;
  className?: string;
  label?: string;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [state, setState] = useState<DictationState>("idle");
  const [message, setMessage] = useState("");

  function startDictation() {
    if (typeof window === "undefined") return;

    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setState("error");
      setMessage("Micro non disponible dans ce navigateur.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "fr-CA";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setState("listening");
      setMessage("Écoute en cours...");
    };

    recognition.onresult = (event) => {
      setState("transcribing");
      const transcript = Array.from({ length: event.results.length - event.resultIndex }, (_, index) => {
        const result = event.results.item(event.resultIndex + index);
        return Array.from({ length: result.length }, (_unused, resultIndex) => result.item(resultIndex).transcript).join("");
      })
        .join(" ")
        .trim();

      if (transcript) onTranscript(transcript);
      setMessage("Transcription ajoutée.");
    };

    recognition.onerror = () => {
      setState("error");
      setMessage("Erreur micro. Vérifiez la permission du navigateur.");
    };

    recognition.onend = () => {
      setState((current) => (current === "error" ? "error" : "idle"));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopDictation() {
    recognitionRef.current?.stop();
    setState("transcribing");
    setMessage("Transcription...");
  }

  const isListening = state === "listening";

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={isListening ? stopDictation : startDictation}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition",
          isListening
            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
        )}
      >
        {isListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        {isListening ? "Arrêter" : state === "transcribing" ? "Transcription..." : state === "error" ? "Erreur micro" : label}
      </button>
      {message ? <p className={cn("text-xs", state === "error" ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400")}>{message}</p> : null}
    </div>
  );
}
