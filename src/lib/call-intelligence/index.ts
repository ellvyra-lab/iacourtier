export { analyzeCallTranscript } from "./analysis";
export { getCallProvider, DemoCallProvider } from "./call-provider";
export { createCallCoachFeedback } from "./coaching";
export { createCallFollowupRecommendation } from "./followup";
export { scoreClosing, scoreConnection, scoreDiscovery, scoreObjectionHandling } from "./scoring";
export { transcribeCall, futureTranscriptionProviders } from "./transcription";
export { TwilioProvider } from "./twilio-provider";
export { handleCallWebhook } from "./webhook";
export type {
  CallAnalysis,
  CallProvider,
  CallProviderId,
  CallRecording,
  CallSource,
  CallStatus,
  CallWebhookEvent,
  PipelineCallRecommendation,
  StartCallInput,
  StartCallResult,
} from "./types";
