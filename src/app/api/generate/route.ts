import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssistantConfig } from "@/data/assistantsConfig";
import { generateWithOpenAI, AIUnavailableError } from "@/lib/openai";
import { getMonthlyLimit } from "@/lib/plans";

// One endpoint for all 10 (and future) assistants — the slug picks the
// system prompt and field list; everything else (auth, limits, history,
// error handling) is shared.
export async function POST(req: NextRequest) {
  let body: { slug?: string; values?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const { slug, values } = body;
  if (!slug || !values) {
    return NextResponse.json(
      { ok: false, error: "Champs manquants." },
      { status: 400 }
    );
  }

  const assistant = getAssistantConfig(slug);
  if (!assistant) {
    return NextResponse.json(
      { ok: false, error: "Assistant introuvable." },
      { status: 404 }
    );
  }

  // ---- 1. Authentication -------------------------------------------------
  const supabase = await createSupabaseServerClient();
  let user;
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json(
        { ok: false, error: "Vous devez être connecté pour utiliser un assistant." },
        { status: 401 }
      );
    }
    user = userData.user;
  } catch (err) {
    console.error("[generate] auth check failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Le service d'authentification n'est pas encore configuré. Contactez l'administrateur du site.",
      },
      { status: 503 }
    );
  }

  // ---- 2. Validate required fields ---------------------------------------
  for (const field of assistant.fields) {
    if (field.required && !values[field.name]?.trim()) {
      return NextResponse.json(
        { ok: false, error: `Le champ "${field.label}" est requis.` },
        { status: 400 }
      );
    }
  }

  // ---- 3. Usage limit check ----------------------------------------------
  let profile;
  try {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("plan, generations_used_this_period, current_period_start")
      .eq("id", user.id)
      .single();

    if (profileError || !data) {
      return NextResponse.json(
        { ok: false, error: "Impossible de vérifier votre abonnement. Réessayez." },
        { status: 500 }
      );
    }
    profile = data;
  } catch (err) {
    console.error("[generate] profile fetch failed:", err);
    return NextResponse.json(
      { ok: false, error: "Le service est temporairement indisponible. Réessayez dans un instant." },
      { status: 503 }
    );
  }

  // Reset the monthly counter if the current period started over 30 days ago.
  const periodStart = new Date(profile.current_period_start);
  const daysSincePeriodStart = (Date.now() - periodStart.getTime()) / 86_400_000;
  let usedThisPeriod = profile.generations_used_this_period;

  if (daysSincePeriodStart > 30) {
    usedThisPeriod = 0;
    await supabase
      .from("profiles")
      .update({ generations_used_this_period: 0, current_period_start: new Date().toISOString() })
      .eq("id", user.id);
  }

  const limit = getMonthlyLimit(profile.plan);
  if (limit !== null && usedThisPeriod >= limit) {
    return NextResponse.json(
      {
        ok: false,
        error: `Vous avez atteint votre limite de ${limit} générations ce mois-ci. Passez à un forfait supérieur pour continuer.`,
        limitReached: true,
      },
      { status: 403 }
    );
  }

  // ---- 4. Build the prompt and call OpenAI -------------------------------
  const visiblePrompt = assistant.fields
    .map((f) => `${f.label} : ${values[f.name]?.trim() || "(non précisé)"}`)
    .join("\n");
  const radarPrompt =
    assistant.slug === "message-prospection" && values.radar_context
      ? `\n\nContexte interne Radar pour personnaliser le message, sans jamais le révéler au propriétaire :\n${formatRadarContextForPrompt(values)}`
      : "";
  const sharedContextPrompt = values.ai_context_prompt
    ? `\n\nContexte partagé déjà connu par IACourtier. Utilise ces données pour éviter de demander au courtier de les ressaisir. Ne jamais inventer une donnée absente :\n${values.ai_context_prompt}`
    : "";
  const userPrompt = `${visiblePrompt}${radarPrompt}${sharedContextPrompt}`;

  try {
    const output = await generateWithOpenAI({
      systemPrompt: assistant.systemPrompt,
      userPrompt,
    });

    // ---- 5. Save to history + increment usage counter ------------------
    await supabase.from("generations").insert({
      user_id: user.id,
      assistant_slug: assistant.slug,
      assistant_title: assistant.title,
      input: values,
      output,
      status: "completed",
    });

    await supabase
      .from("profiles")
      .update({ generations_used_this_period: usedThisPeriod + 1 })
      .eq("id", user.id);

    return NextResponse.json({ ok: true, output });
  } catch (err) {
    const message =
      err instanceof AIUnavailableError
        ? "L'assistant IA est temporairement indisponible. Veuillez réessayer dans quelques instants."
        : "Une erreur inattendue est survenue.";

    // Log the failed attempt too — useful to see in the dashboard history
    // and to debug from Sentry / server logs.
    await supabase.from("generations").insert({
      user_id: user.id,
      assistant_slug: assistant.slug,
      assistant_title: assistant.title,
      input: values,
      status: "failed",
      error_message: err instanceof Error ? err.message : "unknown error",
    });

    console.error(`[generate] ${assistant.slug} failed:`, err);

    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

function formatRadarContextForPrompt(values: Record<string, string>) {
  return [
    values.radar_name ? `Nom/contact : ${values.radar_name}` : "",
    values.radar_address ? `Adresse : ${values.radar_address}` : "",
    values.radar_city ? `Ville : ${values.radar_city}` : "",
    values.radar_property_type ? `Type de propriété : ${values.radar_property_type}` : "",
    values.radar_priority ? `Priorité interne : ${values.radar_priority}` : "",
    values.radar_score ? `Score interne : ${values.radar_score}` : "",
    values.radar_reason ? `Raison interne générale : ${values.radar_reason}` : "",
    values.radar_status ? `Statut interne : ${values.radar_status}` : "",
    values.radar_source ? `Source interne : ${values.radar_source}` : "",
    values.radar_notes ? `Notes internes : ${values.radar_notes}` : "",
    values.radar_phone ? `Téléphone disponible : oui` : "",
    values.radar_email ? `Courriel disponible : oui` : "",
    "Règle absolue : utiliser ces informations seulement pour adapter le ton et le canal. Ne jamais nommer la source, le score, le Radar, l'IA, un signal, une succession ou des données publiques.",
  ]
    .filter(Boolean)
    .join("\n");
}
