import type { CallProvider, CallWebhookEvent, StartCallInput, StartCallResult } from "./types";

export class TwilioProvider implements CallProvider {
  id = "twilio" as const;
  label = "Twilio";

  isConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  }

  async startCall(input: StartCallInput): Promise<StartCallResult> {
    const now = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        mode: "demo",
        message: "Mode démo : les clés Twilio ne sont pas configurées.",
        call: {
          id: `twilio-demo-${Date.now()}`,
          clientId: input.clientId,
          prospectId: input.prospectId,
          source: "demo",
          status: "in_progress",
          from: input.from || process.env.TWILIO_PHONE_NUMBER,
          to: input.to,
          recordingEnabled: input.recordingEnabled,
          createdAt: now,
        },
      };
    }

    return {
      mode: "live",
      message: "Appel prêt à être lancé via Twilio. Branchez l'appel REST Twilio ici sans modifier l'interface provider.",
      call: {
        id: `twilio-call-${Date.now()}`,
        clientId: input.clientId,
        prospectId: input.prospectId,
        source: "twilio",
        status: "queued",
        providerCallId: undefined,
        from: input.from || process.env.TWILIO_PHONE_NUMBER,
        to: input.to,
        recordingEnabled: input.recordingEnabled,
        createdAt: now,
      },
    };
  }

  normalizeWebhook(payload: unknown): CallWebhookEvent {
    const data = payload as Record<string, unknown>;
    const callStatus = String(data.CallStatus || "").toLowerCase();
    const eventType = callStatus === "completed" || callStatus === "busy" || callStatus === "no-answer" ? "call.ended" : "call.started";

    return {
      provider: "twilio",
      providerCallId: String(data.CallSid || data.ParentCallSid || `twilio-${Date.now()}`),
      eventType,
      audioUrl: typeof data.RecordingUrl === "string" ? data.RecordingUrl : undefined,
      transcript: typeof data.TranscriptionText === "string" ? data.TranscriptionText : undefined,
      duration: Number(data.CallDuration || data.RecordingDuration || 0),
      occurredAt: new Date().toISOString(),
      rawPayload: payload,
    };
  }
}
