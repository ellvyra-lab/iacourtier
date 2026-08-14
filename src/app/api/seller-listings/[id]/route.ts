import { NextResponse } from "next/server";

import {
  LISTING_FACT_DEFINITIONS,
  calculateListingReadiness,
  normalizeGeneratedContent,
  questionsForMissingFacts,
  type ListingFact,
  type ListingFactStatus,
} from "@/lib/seller-listings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

    const { data: listing, error } = await supabase
      .from("seller_listings")
      .select("id,status,validation_required,generated_content,branding_snapshot,prepared_at,created_at,updated_at,property_id,property:properties(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    if (!listing) return NextResponse.json({ error: "Dossier vendeur introuvable." }, { status: 404 });

    const [partiesResult, documentsResult, factsResult, mediaResult, tasksResult, automationsResult, activityResult] = await Promise.all([
      supabase.from("seller_listing_parties").select("id,role,contact:seller_contacts(*)").eq("listing_id", id).eq("user_id", user.id),
      supabase.from("seller_listing_documents").select("*").eq("listing_id", id).eq("user_id", user.id).order("created_at"),
      supabase.from("seller_listing_facts").select("*").eq("listing_id", id).eq("user_id", user.id).order("created_at"),
      supabase.from("seller_listing_media").select("*").eq("listing_id", id).eq("user_id", user.id).order("position"),
      supabase.from("seller_listing_tasks").select("*").eq("listing_id", id).eq("user_id", user.id).order("created_at"),
      supabase.from("seller_listing_automations").select("*").eq("listing_id", id).eq("user_id", user.id).order("created_at"),
      supabase.from("seller_listing_activity").select("*").eq("listing_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    const queryError = [partiesResult, documentsResult, factsResult, mediaResult, tasksResult, automationsResult, activityResult].find((result) => result.error)?.error;
    if (queryError) return NextResponse.json({ error: databaseMessage(queryError.message) }, { status: 500 });

    const facts = (factsResult.data || []).map((fact) => ({
      id: fact.id,
      key: fact.fact_key,
      label: fact.label,
      value: fact.value || "",
      status: fact.status as ListingFactStatus,
      sourceLabel: fact.source_label || "Source à confirmer",
      sourceDocumentId: fact.source_document_id,
      confidence: fact.confidence == null ? null : Number(fact.confidence),
      note: fact.note || "",
    }));
    const media = mediaResult.data || [];
    const mediaPaths = media.map((item) => item.storage_path);
    const signedByPath = new Map<string, string>();
    if (mediaPaths.length) {
      const { data: signed } = await supabase.storage.from("seller-listing-files").createSignedUrls(mediaPaths, 60 * 60);
      (signed || []).forEach((item, index) => {
        if (item.signedUrl && mediaPaths[index]) signedByPath.set(mediaPaths[index], item.signedUrl);
      });
    }
    const mediaWithUrls = media.map((item) => ({
      ...item,
      url: signedByPath.get(item.storage_path) || "",
    }));

    const taskRows = tasksResult.data || [];
    const readiness = calculateListingReadiness({
      facts,
      hasSeller: Boolean((partiesResult.data || []).length),
      hasCover: media.some((item) => item.is_cover),
      completedTasks: taskRows.filter((task) => task.status === "completed").length,
      totalTasks: taskRows.length,
    });
    const missingQuestions = questionsForMissingFacts(facts);
    const requiredMissing = missingQuestions.filter((question) => question.required);
    const ambiguous = facts.filter((fact) => fact.status === "to_confirm");
    const hasCover = media.some((item) => item.is_cover);
    const coachItems = [
      ...requiredMissing.slice(0, 3).map((question) => question.label.toLowerCase()),
      ambiguous.length ? `${ambiguous.length} information${ambiguous.length > 1 ? "s" : ""} à confirmer` : "",
      !hasCover ? "la sélection de la photo principale" : "",
    ].filter(Boolean);

    return NextResponse.json({
      listing: {
        ...listing,
        generated_content: normalizeGeneratedContent(listing.generated_content),
      },
      parties: partiesResult.data || [],
      documents: documentsResult.data || [],
      facts,
      media: mediaWithUrls,
      tasks: taskRows,
      automations: automationsResult.data || [],
      activity: activityResult.data || [],
      readiness,
      readyToPrepare: requiredMissing.length === 0 && Boolean((partiesResult.data || []).length),
      missingQuestions,
      coachMessage: coachItems.length
        ? `Ton inscription est prête à ${readiness} %. Il manque ${joinFrench(coachItems)}.`
        : `Ton inscription est prête à ${readiness} %. Les données essentielles sont confirmées; valide maintenant les contenus et les suivis.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger le dossier vendeur." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
    const { data: listing } = await supabase.from("seller_listings").select("id,property_id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!listing) return NextResponse.json({ error: "Dossier vendeur introuvable." }, { status: 404 });

    if (body.action === "fact") {
      const fact = body.fact && typeof body.fact === "object" ? body.fact as Record<string, unknown> : {};
      const status = ["confirmed", "to_confirm", "missing"].includes(String(fact.status)) ? String(fact.status) : "to_confirm";
      const value = String(fact.value || "").trim();
      const definition = LISTING_FACT_DEFINITIONS.find((item) => item.key === String(fact.key));
      if (!definition) return NextResponse.json({ error: "Champ immobilier inconnu." }, { status: 400 });
      const payload = {
        user_id: user.id,
        listing_id: id,
        fact_key: definition.key,
        label: definition.label,
        value,
        status: value ? status : "missing",
        source_label: String(fact.sourceLabel || "Correction du courtier"),
        confidence: status === "confirmed" ? 1 : null,
        note: String(fact.note || ""),
        updated_at: new Date().toISOString(),
      };
      const factId = String(fact.id || "");
      const result = factId
        ? await supabase.from("seller_listing_facts").update(payload).eq("id", factId).eq("listing_id", id).eq("user_id", user.id)
        : await supabase.from("seller_listing_facts").insert(payload);
      if (result.error) return NextResponse.json({ error: databaseMessage(result.error.message) }, { status: 500 });
      await syncPropertyFromFact(supabase, user.id, listing.property_id, definition.key, value);
      await addActivity(supabase, user.id, id, "fact_updated", `${definition.label} ${status === "confirmed" ? "confirmé" : "mis à jour"}`, value);
    } else if (body.action === "task") {
      const taskId = String(body.taskId || "");
      const status = body.status === "completed" ? "completed" : "pending";
      const { error } = await supabase.from("seller_listing_tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", taskId).eq("listing_id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    } else if (body.action === "media") {
      const mediaId = String(body.mediaId || "");
      if (body.isCover === true) {
        await supabase.from("seller_listing_media").update({ is_cover: false }).eq("listing_id", id).eq("user_id", user.id);
      }
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.category === "string") updates.category = body.category;
      if (typeof body.position === "number") updates.position = body.position;
      if (typeof body.isCover === "boolean") updates.is_cover = body.isCover;
      if (typeof body.isVirtualStaging === "boolean") updates.is_virtual_staging = body.isVirtualStaging;
      const { error } = await supabase.from("seller_listing_media").update(updates).eq("id", mediaId).eq("listing_id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    } else if (body.action === "automation") {
      const automationId = String(body.automationId || "");
      const status = body.status === "approved" ? "approved" : body.status === "disabled" ? "disabled" : "validation_required";
      const { error } = await supabase.from("seller_listing_automations").update({
        status,
        external_delivery_enabled: false,
        updated_at: new Date().toISOString(),
      }).eq("id", automationId).eq("listing_id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    await supabase.from("seller_listings").update({ updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mise à jour impossible." }, { status: 500 });
  }
}

async function syncPropertyFromFact(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, propertyId: string | null, key: string, value: string) {
  if (!propertyId) return;
  const column = ({ address: "address", city: "city", postalCode: "postal_code", propertyType: "property_type", lotNumber: "lot_number" } as Record<string, string>)[key];
  if (!column) return;
  await supabase.from("properties").update({ [column]: value, updated_at: new Date().toISOString() }).eq("id", propertyId).eq("user_id", userId);
}

async function addActivity(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, listingId: string, eventType: string, title: string, details?: string) {
  await supabase.from("seller_listing_activity").insert({ user_id: userId, listing_id: listingId, event_type: eventType, title, details: details || null });
}

function joinFrench(items: string[]) {
  if (items.length < 2) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function databaseMessage(message: string) {
  if (/seller_|properties|schema cache|does not exist/i.test(message)) return "La migration Supabase du dossier vendeur n’est pas encore appliquée.";
  return message;
}
