import { NextResponse } from "next/server";

import {
  LISTING_FACT_DEFINITIONS,
  SELLER_AUTOMATION_TEMPLATES,
  SELLER_TASK_TEMPLATES,
  normalizeForDuplicate,
  type ListingFact,
  type ListingPropertyInput,
  type SellerContactInput,
} from "@/lib/seller-listings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CreateListingBody = {
  existingContactIds?: string[];
  sellers?: SellerContactInput[];
  property?: ListingPropertyInput;
  facts?: ListingFact[];
  entryMode?: "existing" | "new" | "documents";
};

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  roles?: string[] | null;
};

type PropertyRow = ListingPropertyInput & { id: string; address: string; city: string; postal_code: string | null; property_type: string | null; lot_number: string | null };

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    const { data, error } = await supabase
      .from("seller_listings")
      .select("id,status,prepared_at,created_at,updated_at,property:properties(address,city,property_type)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    return NextResponse.json({ listings: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les inscriptions." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as CreateListingBody;
    const propertyInput = body.property;
    if (!propertyInput?.address?.trim() || !propertyInput.city?.trim()) {
      return NextResponse.json({ error: "L’adresse et la ville sont requises pour créer le dossier." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    const { data: existingContactsData, error: contactsError } = await supabase
      .from("clients")
      .select("id,first_name,last_name,email,phone,mailing_address,roles")
      .eq("user_id", user.id);
    if (contactsError) return NextResponse.json({ error: databaseMessage(contactsError.message) }, { status: 500 });

    const existingContacts = (existingContactsData || []) as ContactRow[];
    const selectedIds = new Set((body.existingContactIds || []).filter(Boolean));
    const contactIds = existingContacts.filter((contact) => selectedIds.has(contact.id)).map((contact) => contact.id);
    const deduplicated: string[] = [];
    const created: string[] = [];

    for (const seller of body.sellers || []) {
      if (!seller.firstName.trim() && !seller.lastName.trim()) continue;
      const duplicate = findContactDuplicate(existingContacts, seller);
      if (duplicate) {
        if (!contactIds.includes(duplicate.id)) contactIds.push(duplicate.id);
        deduplicated.push(`${duplicate.first_name} ${duplicate.last_name}`.trim());
        const roles = Array.from(new Set([...(duplicate.roles || []), "seller"]));
        await supabase.from("clients").update({ roles, updated_at: new Date().toISOString() }).eq("id", duplicate.id).eq("user_id", user.id);
        continue;
      }
      const { data: inserted, error } = await supabase.from("clients").insert({
        user_id: user.id,
        first_name: seller.firstName.trim(),
        last_name: seller.lastName.trim(),
        email: seller.email.trim() || null,
        phone: seller.phone.trim() || null,
        mailing_address: seller.mailingAddress.trim() || null,
        roles: ["seller"],
      }).select("id,first_name,last_name,email,phone,mailing_address,roles").single();
      if (error || !inserted) return NextResponse.json({ error: databaseMessage(error?.message || "Création du vendeur impossible.") }, { status: 500 });
      const contact = inserted as ContactRow;
      existingContacts.push(contact);
      contactIds.push(contact.id);
      created.push(`${contact.first_name} ${contact.last_name}`.trim());
    }

    if (!contactIds.length) return NextResponse.json({ error: "Sélectionnez ou créez au moins un vendeur." }, { status: 400 });

    const { data: propertyRows, error: propertyQueryError } = await supabase
      .from("properties")
      .select("id,address,city,postal_code,property_type,lot_number")
      .eq("user_id", user.id);
    if (propertyQueryError) return NextResponse.json({ error: databaseMessage(propertyQueryError.message) }, { status: 500 });
    const propertyDuplicate = ((propertyRows || []) as PropertyRow[]).find((property) =>
      normalizeForDuplicate(property.address) === normalizeForDuplicate(propertyInput.address) &&
      normalizeForDuplicate(property.city) === normalizeForDuplicate(propertyInput.city),
    );

    let propertyId = propertyDuplicate?.id;
    if (!propertyId) {
      const { data: property, error } = await supabase.from("properties").insert({
        user_id: user.id,
        address: propertyInput.address.trim(),
        city: propertyInput.city.trim(),
        postal_code: propertyInput.postalCode?.trim() || null,
        property_type: propertyInput.propertyType?.trim() || null,
        lot_number: propertyInput.lotNumber?.trim() || null,
      }).select("id").single();
      if (error || !property) return NextResponse.json({ error: databaseMessage(error?.message || "Création de la propriété impossible.") }, { status: 500 });
      propertyId = property.id;
    }

    const { data: activeListing } = await supabase
      .from("seller_listings")
      .select("id")
      .eq("user_id", user.id)
      .eq("property_id", propertyId)
      .in("status", ["draft", "review", "prepared"])
      .limit(1)
      .maybeSingle();

    let listingId = activeListing?.id as string | undefined;
    const reusedListing = Boolean(listingId);
    if (!listingId) {
      const { data: listing, error } = await supabase.from("seller_listings").insert({
        user_id: user.id,
        property_id: propertyId,
        status: "review",
        validation_required: true,
      }).select("id").single();
      if (error || !listing) return NextResponse.json({ error: databaseMessage(error?.message || "Création du dossier impossible.") }, { status: 500 });
      listingId = listing.id;
    }

    const partyRows = contactIds.map((contactId) => ({ user_id: user.id, listing_id: listingId, contact_id: contactId, role: "seller" }));
    const { error: partiesError } = await supabase.from("seller_listing_parties").upsert(partyRows, { onConflict: "listing_id,contact_id,role" });
    if (partiesError) return NextResponse.json({ error: databaseMessage(partiesError.message) }, { status: 500 });

    const selectedContacts = existingContacts.filter((contact) => contactIds.includes(contact.id));
    const ownerNames = selectedContacts.map((contact) => `${contact.first_name} ${contact.last_name}`.trim()).filter(Boolean).join(" et ");
    const submittedFacts = mergeCanonicalFacts(body.facts || [], propertyInput, ownerNames);
    if (submittedFacts.length) {
      const { data: currentFacts } = await supabase
        .from("seller_listing_facts")
        .select("fact_key,value,source_label")
        .eq("listing_id", listingId)
        .eq("user_id", user.id);
      const rows = submittedFacts
        .filter((fact) => !(currentFacts || []).some((current) => current.fact_key === fact.key && current.value === fact.value && current.source_label === fact.sourceLabel))
        .map((fact) => ({
          user_id: user.id,
          listing_id: listingId,
          fact_key: fact.key,
          label: fact.label,
          value: fact.value,
          status: fact.status,
          source_label: fact.sourceLabel || "Saisie du courtier",
          confidence: fact.confidence ?? null,
          note: fact.note || null,
        }));
      if (rows.length) {
        const { error } = await supabase.from("seller_listing_facts").insert(rows);
        if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
      }
    }

    if (!reusedListing) {
      await supabase.from("seller_listing_tasks").insert(SELLER_TASK_TEMPLATES.map((task) => ({
        user_id: user.id, listing_id: listingId, category: task.category, title: task.title, validation_required: true,
      })));
      await supabase.from("seller_listing_automations").insert(SELLER_AUTOMATION_TEMPLATES.map((name) => ({
        user_id: user.id, listing_id: listingId, name, status: "validation_required", external_delivery_enabled: false,
      })));
    }

    await supabase.from("seller_listing_activity").insert({
      user_id: user.id,
      listing_id: listingId,
      event_type: reusedListing ? "listing_reused" : "listing_created",
      title: reusedListing ? "Dossier existant relié" : "Dossier vendeur créé",
      details: `${contactIds.length} vendeur(s) relié(s). Mode de départ : ${body.entryMode || "new"}.`,
    });

    return NextResponse.json({
      id: listingId,
      reusedListing,
      reusedProperty: Boolean(propertyDuplicate),
      deduplicatedContacts: deduplicated,
      createdContacts: created,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de créer le dossier vendeur." }, { status: 500 });
  }
}

function findContactDuplicate(contacts: ContactRow[], seller: SellerContactInput) {
  const email = normalizeForDuplicate(seller.email);
  const phone = (seller.phone || "").replace(/\D/g, "");
  const name = normalizeForDuplicate(`${seller.firstName}${seller.lastName}`);
  return contacts.find((contact) => {
    const existingEmail = normalizeForDuplicate(contact.email);
    const existingPhone = (contact.phone || "").replace(/\D/g, "");
    const existingName = normalizeForDuplicate(`${contact.first_name}${contact.last_name}`);
    return Boolean((email && existingEmail === email) || (phone && existingPhone === phone) || (name && existingName === name));
  });
}

function mergeCanonicalFacts(facts: ListingFact[], property: ListingPropertyInput, owners: string) {
  const output = facts.filter((fact) => fact.key && (fact.value.trim() || fact.status === "missing"));
  const canonical: Record<string, string> = {
    owners,
    address: property.address,
    city: property.city,
    postalCode: property.postalCode,
    propertyType: property.propertyType,
    lotNumber: property.lotNumber,
  };
  for (const [key, value] of Object.entries(canonical)) {
    if (!value?.trim() || output.some((fact) => fact.key === key && fact.value.trim())) continue;
    const definition = LISTING_FACT_DEFINITIONS.find((item) => item.key === key);
    output.push({ key, label: definition?.label || key, value: value.trim(), status: "confirmed", sourceLabel: "Saisie du courtier", confidence: 1 });
  }
  return output;
}

function databaseMessage(message: string) {
  if (/seller_|properties|schema cache|does not exist/i.test(message)) {
    return "La migration Supabase du dossier vendeur n’est pas encore appliquée.";
  }
  return message;
}

function expiredSession() {
  return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
}
