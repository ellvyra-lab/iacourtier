import { NextResponse } from "next/server";

import { processQuickCapture } from "@/lib/server/process-quick-capture";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    const body = await request.json() as { captureId?: string; clientId?: string | null };
    if (!body.captureId) return NextResponse.json({ error: "Capture introuvable." }, { status: 400 });
    const processed = await processQuickCapture(supabase, user.id, { captureId: body.captureId, selectedClientId: body.clientId });
    return NextResponse.json({ ok: true, ...processed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Traitement impossible.";
    return NextResponse.json({ error: message }, { status: /choisis|reconnu|ambigu/i.test(message) ? 409 : 500 });
  }
}

