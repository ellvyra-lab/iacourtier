import { NextResponse } from "next/server";

import { ensureCentralCase, recordCentralActivity } from "@/lib/server/central-crm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ContactType = "phone" | "email" | "facebook" | "other";
type SearchSource = "google" | "facebook" | "google_facebook" | "google_maps" | "web_ai";

type ProspectInput = {
  key?: string;
  name?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  propertyType?: string;
  reason?: string;
  source?: string;
};

type ReachabilityBody = {
  action?: "log_search" | "confirm_contact" | "create_followup";
  prospect?: ProspectInput;
  searchSource?: SearchSource;
  searchUrl?: string;
  searchLabel?: string;
  contactType?: ContactType;
  value?: string;
  label?: string;
  sourceUrl?: string;
  identityConfirmed?: boolean;
};

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vous devez être connecté pour voir cette recherche." }, { status: 401 });

  const prospectKey = cleanText(new URL(request.url).searchParams.get("prospectKey"), 500);
  if (!prospectKey) return NextResponse.json({ error: "L’opportunité Radar est manquante." }, { status: 400 });

  try {
    return NextResponse.json(await loadSnapshot(supabase, user.id, prospectKey));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "La recherche de coordonnées n’a pas pu être chargée.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vous devez être connecté pour enregistrer cette recherche." }, { status: 401 });

  try {
    const body = await request.json() as ReachabilityBody;
    const prospect = normalizeProspect(body.prospect);

    if (body.action === "log_search") {
      const source = body.searchSource;
      if (!source || !["google", "facebook", "google_facebook", "google_maps", "web_ai"].includes(source)) {
        return NextResponse.json({ error: "La source de recherche est invalide." }, { status: 400 });
      }
      const searchUrl = optionalPublicUrl(body.searchUrl);
      await insertResearchEvent(supabase, {
        userId: user.id,
        prospectKey: prospect.key,
        eventType: "search_opened",
        sourceType: source,
        sourceUrl: searchUrl,
        title: cleanText(body.searchLabel, 180) || searchTitle(source),
        details: `${prospect.name || "Prospect"} · ${[prospect.address, prospect.city].filter(Boolean).join(", ")}`,
        metadata: { query_url: searchUrl },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "confirm_contact") {
      if (!body.identityConfirmed) {
        return NextResponse.json({ error: "Confirmez d’abord qu’il s’agit de la bonne personne." }, { status: 400 });
      }
      if (!body.contactType || !["phone", "email", "facebook", "other"].includes(body.contactType)) {
        return NextResponse.json({ error: "Choisissez un type de coordonnée valide." }, { status: 400 });
      }
      const contact = validateContact(body.contactType, body.value);
      const crm = await ensureRadarCrm(supabase, user.id, prospect);
      const now = new Date().toISOString();
      const sourceUrl = optionalPublicUrl(body.sourceUrl);

      if (contact.type === "phone" || contact.type === "email") {
        await persistContactMethod(supabase, {
          userId: user.id,
          clientId: crm.clientId,
          type: contact.type,
          value: contact.value,
          normalized: contact.normalized,
          sourceUrl,
          now,
        });
      } else {
        const { error } = await supabase.from("client_public_links").upsert({
          user_id: user.id,
          client_id: crm.clientId,
          link_type: contact.type,
          label: cleanText(body.label, 100) || (contact.type === "facebook" ? "Facebook" : "Lien public"),
          url: contact.value,
          normalized_url: contact.normalized,
          source: "manual_public_search",
          source_url: sourceUrl,
          confirmed_at: now,
          updated_at: now,
        }, { onConflict: "client_id,normalized_url" });
        if (error) throw error;
      }

      const label = contact.type === "phone" ? "Téléphone" : contact.type === "email" ? "Courriel" : contact.type === "facebook" ? "Profil Facebook" : "Lien public";
      await Promise.all([
        insertResearchEvent(supabase, {
          userId: user.id,
          prospectKey: prospect.key,
          clientId: crm.clientId,
          caseId: crm.caseId,
          eventType: "contact_confirmed",
          sourceType: "manual_public_search",
          sourceUrl,
          title: `${label} confirmé`,
          details: contact.value,
          metadata: { contact_type: contact.type, confirmed_by: user.id, confirmed_at: now },
        }),
        recordCentralActivity(supabase, {
          userId: user.id,
          clientId: crm.clientId,
          caseId: crm.caseId,
          eventType: "radar_contact_confirmed",
          title: `${label} confirmé depuis le Radar`,
          details: `Source : manual_public_search${sourceUrl ? ` · ${sourceUrl}` : ""}`,
        }),
      ]);

      if (contact.type === "phone") {
        await insertResearchEvent(supabase, {
          userId: user.id,
          prospectKey: prospect.key,
          clientId: crm.clientId,
          caseId: crm.caseId,
          eventType: "ready_to_call",
          sourceType: "crm",
          title: "Prospect prêt à appeler",
          details: contact.value,
          metadata: { phone: contact.value },
        });
      }

      return NextResponse.json({ ok: true, ...(await loadSnapshot(supabase, user.id, prospect.key)) });
    }

    if (body.action === "create_followup") {
      const crm = await ensureRadarCrm(supabase, user.id, prospect);
      const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const title = `Trouver les coordonnées de ${prospect.name || prospect.address || "ce prospect"}`;
      const { error } = await supabase.from("tasks").upsert({
        user_id: user.id,
        client_id: crm.clientId,
        case_id: crm.caseId,
        category: "prospection",
        title,
        status: "pending",
        due_at: dueAt,
        validation_required: true,
      }, { onConflict: "case_id,title" });
      if (error) throw error;
      await insertResearchEvent(supabase, {
        userId: user.id,
        prospectKey: prospect.key,
        clientId: crm.clientId,
        caseId: crm.caseId,
        eventType: "follow_up_created",
        sourceType: "manual_public_search",
        title: "Suivi de recherche créé",
        details: `Échéance : ${dueAt}`,
        metadata: { due_at: dueAt },
      });
      await recordCentralActivity(supabase, { userId: user.id, clientId: crm.clientId, caseId: crm.caseId, eventType: "radar_contact_follow_up", title, details: "Aucune coordonnée fiable trouvée pour le moment." });
      return NextResponse.json({ ok: true, ...(await loadSnapshot(supabase, user.id, prospect.key)) });
    }

    return NextResponse.json({ error: "Action Radar inconnue." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "L’action n’a pas pu être enregistrée.") }, { status: 500 });
  }
}

async function ensureRadarCrm(supabase: Supabase, userId: string, prospect: Required<ProspectInput>) {
  const { data: existingLink, error: linkError } = await supabase.from("radar_crm_links").select("client_id,case_id,property_id").eq("user_id", userId).eq("prospect_key", prospect.key).maybeSingle();
  if (linkError) throw linkError;
  if (existingLink) return { clientId: existingLink.client_id as string, caseId: existingLink.case_id as string, propertyId: existingLink.property_id as string | null };

  if (!prospect.name) throw new Error("Ajoutez le nom du propriétaire avant de confirmer son identité.");
  const { firstName, lastName } = splitName(prospect.name);
  const { data: clients, error: clientsError } = await supabase.from("clients").select("id,first_name,last_name,email,phone,roles,tags").eq("user_id", userId);
  if (clientsError) throw clientsError;
  let client = (clients || []).find((item) => normalizeText(`${item.first_name} ${item.last_name}`) === normalizeText(prospect.name));
  const reusedClient = Boolean(client);

  if (!client) {
    const { data, error } = await supabase.from("clients").insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      roles: ["prospect"],
      tags: ["Prospect Radar"],
      client_status: "prospect",
      source: prospect.source || "Radar de prospection",
      notes: prospect.reason || null,
    }).select("id,first_name,last_name,email,phone,roles,tags").single();
    if (error || !data) throw error || new Error("Création du client CRM impossible.");
    client = data;
  } else {
    const { error } = await supabase.from("clients").update({
      roles: Array.from(new Set([...(client.roles || []), "prospect"])),
      tags: Array.from(new Set([...(client.tags || []), "Prospect Radar"])),
      updated_at: new Date().toISOString(),
    }).eq("id", client.id).eq("user_id", userId);
    if (error) throw error;
  }

  let propertyId: string | null = null;
  if (prospect.address) {
    const { data: properties, error: propertiesError } = await supabase.from("properties").select("id,address,city").eq("user_id", userId);
    if (propertiesError) throw propertiesError;
    propertyId = (properties || []).find((item) => normalizeText(item.address) === normalizeText(prospect.address) && normalizeText(item.city) === normalizeText(prospect.city))?.id || null;
    if (!propertyId) {
      const { data, error } = await supabase.from("properties").insert({
        user_id: userId,
        address: prospect.address,
        city: prospect.city || "À confirmer",
        postal_code: prospect.postalCode || null,
        property_type: prospect.propertyType || null,
      }).select("id").single();
      if (error || !data) throw error || new Error("Création de la propriété impossible.");
      propertyId = data.id;
    }
  }

  const caseQuery = supabase.from("client_cases").select("id").eq("user_id", userId).eq("primary_client_id", client.id).eq("case_type", "prospect").eq("status", "active");
  const { data: existingCase, error: existingCaseError } = propertyId ? await caseQuery.eq("property_id", propertyId).limit(1).maybeSingle() : await caseQuery.is("property_id", null).limit(1).maybeSingle();
  if (existingCaseError) throw existingCaseError;
  const caseId = await ensureCentralCase(supabase, {
    userId,
    primaryClientId: client.id,
    propertyId,
    participantIds: [client.id],
    caseType: "prospect",
    title: propertyId ? `Prospection — ${prospect.address}` : `Prospection — ${prospect.name}`,
    status: "active",
    pipelineStage: "new_contact",
    nextAction: "Contacter et qualifier le prospect",
    source: prospect.source || "radar",
    centralCaseId: existingCase?.id || null,
  });

  const { error: mapError } = await supabase.from("radar_crm_links").upsert({
    user_id: userId,
    prospect_key: prospect.key,
    client_id: client.id,
    case_id: caseId,
    property_id: propertyId,
    confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,prospect_key" });
  if (mapError) throw mapError;

  await supabase.from("tasks").upsert({ user_id: userId, client_id: client.id, case_id: caseId, category: "prospection", title: "Contacter et qualifier le prospect", status: "pending", validation_required: true }, { onConflict: "case_id,title", ignoreDuplicates: true });
  await recordCentralActivity(supabase, { userId, clientId: client.id, caseId, eventType: reusedClient || existingCase ? "radar_relinked" : "radar_linked", title: reusedClient || existingCase ? "Prospect Radar relié au CRM existant" : "Prospect Radar ajouté au CRM", details: prospect.reason || null });
  return { clientId: client.id as string, caseId, propertyId };
}

async function persistContactMethod(supabase: Supabase, input: { userId: string; clientId: string; type: "phone" | "email"; value: string; normalized: string; sourceUrl: string | null; now: string }) {
  const { data: client, error: clientError } = await supabase.from("clients").select("phone,email").eq("id", input.clientId).eq("user_id", input.userId).single();
  if (clientError) throw clientError;
  const field = input.type === "phone" ? "phone" : "email";
  if (!cleanText(client[field], 320)) {
    const { error } = await supabase.from("clients").update({ [field]: input.value, updated_at: input.now }).eq("id", input.clientId).eq("user_id", input.userId);
    if (error) throw error;
  }
  const { error } = await supabase.from("client_contact_methods").upsert({
    user_id: input.userId,
    client_id: input.clientId,
    method_type: input.type,
    label: "primary",
    value: input.value,
    normalized_value: input.normalized,
    is_primary: true,
    confidence: 1,
    status: "confirmed",
    source: "manual_public_search",
    source_url: input.sourceUrl,
    confirmed_at: input.now,
    updated_at: input.now,
  }, { onConflict: "client_id,method_type,normalized_value" });
  if (error) throw error;
}

async function loadSnapshot(supabase: Supabase, userId: string, prospectKey: string) {
  const { data: link, error: linkError } = await supabase.from("radar_crm_links").select("client_id,case_id,property_id,confirmed_at").eq("user_id", userId).eq("prospect_key", prospectKey).maybeSingle();
  if (linkError) throw linkError;
  const { data: events, error: eventsError } = await supabase.from("radar_contact_research_events").select("id,event_type,source_type,source_url,title,details,metadata,created_at").eq("user_id", userId).eq("prospect_key", prospectKey).order("created_at", { ascending: false }).limit(40);
  if (eventsError) throw eventsError;
  if (!link) return { linked: false, contact: null, history: events || [] };

  const [clientResult, methodsResult, linksResult] = await Promise.all([
    supabase.from("clients").select("id,first_name,last_name,phone,email").eq("id", link.client_id).eq("user_id", userId).single(),
    supabase.from("client_contact_methods").select("method_type,value,is_primary,source,source_url,confirmed_at,updated_at").eq("user_id", userId).eq("client_id", link.client_id).order("is_primary", { ascending: false }).order("updated_at", { ascending: false }),
    supabase.from("client_public_links").select("id,link_type,label,url,source,source_url,confirmed_at,updated_at").eq("user_id", userId).eq("client_id", link.client_id).order("updated_at", { ascending: false }),
  ]);
  if (clientResult.error || methodsResult.error || linksResult.error) throw clientResult.error || methodsResult.error || linksResult.error;
  const phone = methodsResult.data?.find((item) => item.method_type === "phone")?.value || clientResult.data.phone || null;
  const email = methodsResult.data?.find((item) => item.method_type === "email")?.value || clientResult.data.email || null;
  const facebookUrl = linksResult.data?.find((item) => item.link_type === "facebook")?.url || null;
  return {
    linked: true,
    clientId: link.client_id,
    caseId: link.case_id,
    propertyId: link.property_id,
    contact: { name: `${clientResult.data.first_name || ""} ${clientResult.data.last_name || ""}`.trim(), phone, email, facebookUrl, links: linksResult.data || [] },
    history: events || [],
  };
}

async function insertResearchEvent(supabase: Supabase, input: { userId: string; prospectKey: string; clientId?: string; caseId?: string; eventType: string; sourceType: string; sourceUrl?: string | null; title: string; details?: string | null; metadata?: Record<string, unknown> }) {
  const { error } = await supabase.from("radar_contact_research_events").insert({
    user_id: input.userId,
    prospect_key: input.prospectKey,
    client_id: input.clientId || null,
    case_id: input.caseId || null,
    event_type: input.eventType,
    source_type: input.sourceType,
    source_url: input.sourceUrl || null,
    title: input.title,
    details: input.details || null,
    metadata: input.metadata || {},
  });
  if (error) throw error;
}

function normalizeProspect(input?: ProspectInput): Required<ProspectInput> {
  const prospect = {
    key: cleanText(input?.key, 500),
    name: cleanText(input?.name, 200),
    address: cleanText(input?.address, 300),
    city: cleanText(input?.city, 160),
    province: cleanText(input?.province, 100),
    postalCode: cleanText(input?.postalCode, 20),
    propertyType: cleanText(input?.propertyType, 120),
    reason: cleanText(input?.reason, 1000),
    source: cleanText(input?.source, 120),
  };
  if (!prospect.key) throw new Error("L’opportunité Radar est manquante.");
  return prospect;
}

function validateContact(type: ContactType, rawValue?: string) {
  const value = cleanText(rawValue, 1000);
  if (!value) throw new Error("Entrez la coordonnée à enregistrer.");
  if (type === "phone") {
    const normalized = value.replace(/\D/g, "");
    if (normalized.length < 7 || normalized.length > 15) throw new Error("Le numéro de téléphone semble invalide.");
    return { type, value, normalized } as const;
  }
  if (type === "email") {
    const normalized = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Le courriel semble invalide.");
    return { type, value, normalized } as const;
  }
  const url = requiredPublicUrl(value);
  if (type === "facebook" && !new URL(url).hostname.toLowerCase().endsWith("facebook.com")) throw new Error("Entrez une URL Facebook valide.");
  return { type, value: url, normalized: url.toLowerCase().replace(/\/$/, "") } as const;
}

function requiredPublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error("L’adresse Web doit commencer par https:// ou http://.");
  }
}

function optionalPublicUrl(value?: string | null) {
  const cleaned = cleanText(value, 2000);
  return cleaned ? requiredPublicUrl(cleaned) : null;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || "Prospect", lastName: parts.join(" ") };
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeText(value: unknown) {
  return cleanText(value, 500).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function searchTitle(source: SearchSource) {
  return ({ google: "Recherche Google ouverte", facebook: "Recherche Facebook ouverte", google_facebook: "Recherche Google vers Facebook ouverte", google_maps: "Google Maps ouvert", web_ai: "Recherche Web/IA ouverte" })[source];
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

