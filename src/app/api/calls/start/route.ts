import { NextResponse } from "next/server";

import { getCallProvider, type CallProviderId, type StartCallInput } from "@/lib/call-intelligence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as StartCallInput;

  if (!body.to?.trim()) {
    return NextResponse.json({ error: "Le numéro à appeler est requis." }, { status: 400 });
  }

  const provider = getCallProvider((body.provider || "twilio") as CallProviderId);
  const result = await provider.startCall(body);

  return NextResponse.json(result);
}
