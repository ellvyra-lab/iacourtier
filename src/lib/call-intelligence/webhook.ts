import { analyzeCallTranscript } from "./analysis";
import { createCallCoachFeedback } from "./coaching";
import { createCallFollowupRecommendation } from "./followup";
import { getCallProvider } from "./call-provider";
import { transcribeCall } from "./transcription";
import type { CallProviderId } from "./types";

export async function handleCallWebhook(providerId: CallProviderId, payload: unknown) {
  const provider = getCallProvider(providerId);
  const event = provider.normalizeWebhook(payload);
  const call = {
    id: event.providerCallId,
    source: event.provider,
    status: event.eventType === "call.ended" ? "ended" : "in_progress",
    providerCallId: event.providerCallId,
    audioUrl: event.audioUrl,
    transcript: event.transcript,
    duration: event.duration,
    createdAt: event.occurredAt,
  } as const;
  const transcription = await transcribeCall(call);
  const analysis = transcription.transcript ? analyzeCallTranscript({ ...call, transcript: transcription.transcript }) : null;

  return {
    event,
    call,
    transcription,
    analysis,
    coaching: analysis ? createCallCoachFeedback(analysis) : null,
    followup: analysis ? createCallFollowupRecommendation(analysis) : null,
  };
}
