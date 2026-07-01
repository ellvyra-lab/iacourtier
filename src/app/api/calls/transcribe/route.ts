import { NextResponse } from "next/server";

import { transcribeCall, type CallRecording } from "@/lib/call-intelligence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const call = (await request.json()) as CallRecording;
  const result = await transcribeCall(call);
  return NextResponse.json(result);
}
