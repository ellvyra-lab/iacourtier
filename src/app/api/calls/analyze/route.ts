import { NextResponse } from "next/server";

import { analyzeCallTranscript, createCallCoachFeedback, createCallFollowupRecommendation, type CallRecording } from "@/lib/call-intelligence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const call = (await request.json()) as CallRecording;

  if (!call.transcript?.trim()) {
    return NextResponse.json({ error: "La transcription est requise pour analyser l'appel." }, { status: 400 });
  }

  const analysis = analyzeCallTranscript(call);
  return NextResponse.json({
    analysis,
    coaching: createCallCoachFeedback(analysis),
    followup: createCallFollowupRecommendation(analysis, { clientId: call.clientId, prospectId: call.prospectId }),
  });
}
