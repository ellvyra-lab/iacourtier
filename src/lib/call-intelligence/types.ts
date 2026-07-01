export type CallProviderId = "twilio" | "aircall" | "ringcentral" | "dialpad" | "mobile" | "demo";

export type CallSource = CallProviderId | "manual_upload" | "manual_transcript";

export type CallStatus = "queued" | "ringing" | "in_progress" | "ended" | "transcribing" | "transcribed" | "analyzing" | "analyzed" | "failed";

export type CallRecording = {
  id: string;
  clientId?: string;
  prospectId?: string;
  source: CallSource;
  status: CallStatus;
  providerCallId?: string;
  from?: string;
  to?: string;
  audioUrl?: string;
  transcript?: string;
  duration?: number;
  recordingEnabled?: boolean;
  createdAt: string;
  analyzedAt?: string;
};

export type CallAnalysis = {
  callId: string;
  summary: string;
  talkTimeRatioAgent: number;
  talkTimeRatioClient: number;
  questionsAsked: number;
  openQuestionsCount: number;
  objectionsDetected: string[];
  motivationDetected: boolean;
  appointmentAskDetected: boolean;
  nextStepDetected: boolean;
  strengths: string[];
  weaknesses: string[];
  missedOpportunities: string[];
  suggestedResponse: string;
  nextBestQuestion: string;
  recommendedFollowup: string;
  clientNote: string;
  scoreDiscovery: number;
  scoreConnection: number;
  scoreObjectionHandling: number;
  scoreClosing: number;
  globalScore: number;
};

export type PipelineCallRecommendation = {
  clientId?: string;
  prospectId?: string;
  suggestedStatus?: string;
  timelineNote: string;
  followupTask: string;
  nextAction: string;
};

export type StartCallInput = {
  to: string;
  from?: string;
  clientId?: string;
  prospectId?: string;
  recordingEnabled?: boolean;
  provider?: CallProviderId;
};

export type StartCallResult = {
  mode: "live" | "demo";
  call: CallRecording;
  message: string;
};

export type CallWebhookEvent = {
  provider: CallProviderId;
  providerCallId: string;
  eventType: "call.started" | "call.ended" | "recording.ready" | "transcription.ready";
  audioUrl?: string;
  transcript?: string;
  duration?: number;
  occurredAt: string;
  rawPayload?: unknown;
};

export type CallProvider = {
  id: CallProviderId;
  label: string;
  isConfigured(): boolean;
  startCall(input: StartCallInput): Promise<StartCallResult>;
  normalizeWebhook(payload: unknown): CallWebhookEvent;
};
