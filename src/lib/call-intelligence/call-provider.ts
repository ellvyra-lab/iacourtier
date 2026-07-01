import { TwilioProvider } from "./twilio-provider";
import type { CallProvider, CallProviderId, StartCallInput, StartCallResult } from "./types";

export function getCallProvider(id: CallProviderId = "twilio"): CallProvider {
  if (id === "twilio") return new TwilioProvider();
  return new DemoCallProvider(id);
}

export class DemoCallProvider implements CallProvider {
  id: CallProviderId;
  label: string;

  constructor(id: CallProviderId = "demo") {
    this.id = id;
    this.label = `${id} demo`;
  }

  isConfigured() {
    return false;
  }

  async startCall(input: StartCallInput): Promise<StartCallResult> {
    const now = new Date().toISOString();
    return {
      mode: "demo",
      message: "Mode démo : configurez un provider téléphonique pour lancer de vrais appels.",
      call: {
        id: `demo-call-${Date.now()}`,
        clientId: input.clientId,
        prospectId: input.prospectId,
        source: "demo",
        status: "in_progress",
        from: input.from,
        to: input.to,
        recordingEnabled: input.recordingEnabled,
        createdAt: now,
      },
    };
  }

  normalizeWebhook(payload: unknown) {
    const data = payload as Record<string, unknown>;
    return {
      provider: this.id,
      providerCallId: String(data.CallSid || data.callId || `demo-${Date.now()}`),
      eventType: "call.ended" as const,
      audioUrl: typeof data.RecordingUrl === "string" ? data.RecordingUrl : undefined,
      transcript: typeof data.TranscriptionText === "string" ? data.TranscriptionText : undefined,
      duration: Number(data.CallDuration || 0),
      occurredAt: new Date().toISOString(),
      rawPayload: payload,
    };
  }
}
