import { NextResponse } from "next/server";

import { handleCallWebhook, type CallProviderId } from "@/lib/call-intelligence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const provider = (new URL(request.url).searchParams.get("provider") || "twilio") as CallProviderId;
  const payload = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  const result = await handleCallWebhook(provider, payload);
  return NextResponse.json(result);
}
