import { NextResponse } from "next/server";

import { formatBrokerProfileForPrompt, normalizeBrokerProfile } from "@/lib/broker-profile";
import { parseJsonObject } from "@/lib/mandate-document-extraction";
import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import {
  LISTING_FACT_DEFINITIONS,
  SELLER_AUTOMATION_TEMPLATES,
  SELLER_TASK_TEMPLATES,
  normalizeGeneratedContent,
} from "@/lib/seller-listings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { brokerProfile?: unknown };
    const brokerProfile = normalizeBrokerProfile(body.brokerProfile);
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

    const { data: listing } = await supabase
      .from("seller_listings")
      .select("id,property:properties(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!listing) return NextResponse.json({ error: "Dossier vendeur introuvable." }, { status: 404 });

    const [factsResult, partiesResult] = await Promise.all([
      supabase.from("seller_listing_facts").select("fact_key,label,value,status,source_label,note").eq("listing_id", id).eq("user_id", user.id),
      supabase.from("seller_listing_parties").select("contact:clients(first_name,last_name)").eq("listing_id", id).eq("user_id", user.id),
    ]);
    if (factsResult.error || partiesResult.error) {
      return NextResponse.json({ error: factsResult.error?.message || partiesResult.error?.message }, { status: 500 });
    }

    const confirmedFacts = (factsResult.data || []).filter((fact) => fact.status === "confirmed" && fact.value?.trim());
    const sellerNames = (partiesResult.data || []).map((party) => {
      const contact = Array.isArray(party.contact) ? party.contact[0] : party.contact;
      return contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "";
    }).filter(Boolean);
    const confirmedKeys = new Set(confirmedFacts.map((fact) => fact.fact_key));
    const missingRequired = LISTING_FACT_DEFINITIONS.filter((definition) => definition.required && !confirmedKeys.has(definition.key));
    if (!sellerNames.length || missingRequired.length) {
      return NextResponse.json({
        error: `Confirmez d’abord ${[!sellerNames.length ? "au moins un vendeur" : "", ...missingRequired.map((item) => item.label.toLowerCase())].filter(Boolean).join(", ")}.`,
      }, { status: 409 });
    }

    const reviewItems = (factsResult.data || []).filter((fact) => fact.status !== "confirmed").map((fact) => `${fact.label}: ${fact.value || "manquant"}`);
    const professionalProfile = formatBrokerProfileForPrompt(brokerProfile);
    const systemPrompt = `Tu prépares une inscription immobilière québécoise et sa mise en marché à partir d'un dossier confirmé.

Règles de sécurité non négociables :
- Utilise exclusivement les faits confirmés fournis. Ne complète jamais une caractéristique par vraisemblance.
- N'invente aucune déclaration, garantie, servitude, hypothèque, rénovation, mesure, pièce, inclusion ou condition.
- L'addenda ne doit contenir que des faits confirmés. Tout élément juridique ou contractuel incertain va dans validationPoints, jamais dans l'addenda.
- Les contenus externes utilisent le profil professionnel fourni. Ne mentionne jamais IACourtier et n'écris jamais « Sonia de IACourtier ».
- Si une donnée utile manque (prix de visite libre, date, heure, etc.), emploie un marqueur clair « [À CONFIRMER] ».
- Retourne uniquement un JSON valide, sans Markdown.

Structure JSON obligatoire :
{
  "listing": {
    "publicDescription":"", "shortDescription":"", "addendum":"",
    "highlights":[""], "characteristics":[""], "sellerSummary":"",
    "validationPoints":[""], "dossierChecklist":[""], "marketingChecklist":[""]
  },
  "marketing": {
    "facebook":"", "instagram":"", "facebookStory":[""], "instagramStory":[""],
    "carousel":[{"title":"","text":""}], "comingSoon":"", "newListing":"", "openHouse":"",
    "reelScript":"", "presentationVideoScript":"", "shortVideoScript":"",
    "buyerEmail":"", "brokerEmail":"", "sms":""
  }
}`;
    const userPrompt = [
      `VENDEUR(S) CONFIRMÉ(S)\n${sellerNames.join("; ")}`,
      `FAITS CONFIRMÉS ET SOURCES\n${confirmedFacts.map((fact) => `- ${fact.label}: ${fact.value} — Source: ${fact.source_label}`).join("\n")}`,
      `ÉLÉMENTS À VALIDER OU MANQUANTS\n${reviewItems.length ? reviewItems.join("\n") : "Aucun élément additionnel consigné."}`,
      `PROFIL PROFESSIONNEL À UTILISER\n${professionalProfile || "Profil non configuré: ne crée aucune identité ou coordonnée."}`,
    ].join("\n\n");

    const aiText = await generateWithOpenAI({ systemPrompt, userPrompt, maxTokens: 6000, temperature: 0.25 });
    const parsed = normalizeGeneratedContent(parseJsonObject(aiText));
    const brokerLabel = brokerProfile.fullName || "Votre courtier";
    const scrubbed = normalizeGeneratedContent(JSON.parse(JSON.stringify(parsed).replace(/Sonia de IACourtier/gi, brokerLabel).replace(/IACourtier/gi, "")));
    const automaticValidationPoints = [
      ...(factsResult.data || []).filter((fact) => fact.status === "to_confirm").map((fact) => `${fact.label}: ${fact.value || "à confirmer"}`),
      ...LISTING_FACT_DEFINITIONS.filter((definition) => !confirmedKeys.has(definition.key)).map((definition) => `${definition.label}: information non confirmée`),
      !brokerProfile.fullName ? "Profil professionnel du courtier à compléter avant diffusion externe" : "",
    ].filter(Boolean);
    scrubbed.listing.validationPoints = unique([...scrubbed.listing.validationPoints, ...automaticValidationPoints]);
    if (!scrubbed.listing.dossierChecklist.length) scrubbed.listing.dossierChecklist = SELLER_TASK_TEMPLATES.filter((task) => task.category === "dossier" || task.category === "inscription").map((task) => task.title);
    if (!scrubbed.listing.marketingChecklist.length) scrubbed.listing.marketingChecklist = SELLER_TASK_TEMPLATES.filter((task) => task.category === "marketing" || task.category === "photos").map((task) => task.title);

    const now = new Date().toISOString();
    const { error: saveError } = await supabase.from("seller_listings").update({
      status: "prepared",
      generated_content: scrubbed,
      branding_snapshot: brokerProfile,
      prepared_at: now,
      updated_at: now,
      validation_required: true,
    }).eq("id", id).eq("user_id", user.id);
    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

    await supabase.from("seller_listing_activity").insert({
      user_id: user.id,
      listing_id: id,
      event_type: "listing_prepared",
      title: "Inscription et plan marketing préparés",
      details: `${SELLER_AUTOMATION_TEMPLATES.length} automatisations demeurent en validation requise. Aucun envoi externe n’a été effectué.`,
    });
    return NextResponse.json({ content: scrubbed, saved: true, preparedAt: now });
  } catch (error) {
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) return NextResponse.json(openAIError.body, { status: openAIError.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Préparation impossible." }, { status: 500 });
  }
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
