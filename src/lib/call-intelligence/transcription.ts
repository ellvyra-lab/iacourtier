import type { CallRecording } from "./types";

export type TranscriptionResult = {
  callId: string;
  transcript: string;
  status: CallRecording["status"];
};

export async function transcribeCall(recording: CallRecording): Promise<TranscriptionResult> {
  if (recording.transcript?.trim()) {
    return { callId: recording.id, transcript: recording.transcript.trim(), status: "transcribed" };
  }

  return {
    callId: recording.id,
    transcript: "",
    status: "transcribing",
  };
}

export const futureTranscriptionProviders = ["OpenAI Whisper", "Twilio transcription", "Aircall transcription", "RingCentral transcription", "Dialpad transcription"];
