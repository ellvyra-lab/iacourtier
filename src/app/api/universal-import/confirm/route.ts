import { NextResponse } from "next/server";

import { BUYER_AUTOMATION_TEMPLATES, BUYER_TASK_TEMPLATES } from "@/lib/buyer-cases";
import { SELLER_AUTOMATION_TEMPLATES, SELLER_TASK_TEMPLATES } from "@/lib/seller-listings";
import { fileExtension } from "@/lib/server/image-analysis";
import { ensureCentralCase, recordCentralActivity, syncCentralDocument, syncCentralWorkflow } from "@/lib/server/central-crm";
import { applyContinuousMerge, loadContinuousMergeContext, MergeValidationError, type LoadedMergeContext } from "@/lib/server/continuous-merge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeUniversalValue,
  sanitizeAnalysisForConfirmation,
  type PersonDecision,
  type MergeDecision,
  type UniversalAnalysis,
  type UniversalPerson,
} from "@/lib/universal-import";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 12;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"]);

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  roles: string[] | null;
};

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const formData = await request.formData();
    const analysisRaw = parseFormJson(formData.get("analysis"), "L’analyse à confirmer est absente.");
    const decisionsRaw = parseFormJson(formData.get("decisions"), "Les choix de doublons sont absents.");
    const analysis = sanitizeAnalysisForConfirmation(analysisRaw);
    const decisions = Array.isArray(decisionsRaw) ? decisionsRaw as PersonDecision[] : [];
    const mergeDecisionsRaw = parseFormJson(formData.get("mergeDecisions") || "[]", "Les décisions de fusion sont invalides.");
    const mergeDecisions = Array.isArray(mergeDecisionsRaw) ? mergeDecisionsRaw as MergeDecision[] : [];
    const requestedCaseId = typeof formData.get("caseId") === "string" ? String(formData.get("caseId") || "").trim() : "";
    let existingMergeContext: LoadedMergeContext | null = requestedCaseId ? await loadContinuousMergeContext(supabase, user.id, requestedCaseId) : null;
    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);

    const validationError = validateConfirmation(analysis, files, Boolean(existingMergeContext));
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const sourceNames = new Set(analysis.sources.map((source) => source.name));
    if (files.some((file) => !sourceNames.has(file.name))) {
      return NextResponse.json({ error: "Les fichiers ont changé depuis l’analyse. Relance l’analyse avant de confirmer." }, { status: 409 });
    }

    // Store the already-confirmed incoming sources first. If any upload fails,
    // no client or dossier has yet been created.
    const importId = crypto.randomUUID();
    const stored = [] as Array<{ file: File; path: string }>;
    for (const file of files) {
      const path = `${user.id}/universal-imports/${importId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from("seller-listing-files").upload(path, await file.arrayBuffer(), {
        contentType: normalizedMime(file), upsert: false,
      });
      if (error) {
        if (uploadedPaths.length) await supabase.storage.from("seller-listing-files").remove(uploadedPaths);
        return NextResponse.json({ error: `Échec du téléversement de « ${file.name} » dans seller-listing-files : ${error.message}` }, { status: 500 });
      }
      uploadedPaths.push(path);
      stored.push({ file, path });
    }

    const { data: currentContacts, error: contactsError } = await supabase
      .from("clients")
      .select("id,first_name,last_name,email,phone,mailing_address,roles")
      .eq("user_id", user.id);
    if (contactsError) throw contactsError;

    const contacts = (currentContacts || []) as ContactRow[];
    const contactIds = new Map<string, string>();
    const reusedContacts: string[] = [];
    const createdContacts: string[] = [];

    for (const person of analysis.people) {
      const matches = contacts.filter((contact) => isDuplicate(person, contact));
      let decision = decisions.find((item) => item.personId === person.id);
      if (!decision && matches.length === 1) decision = { personId: person.id, action: "use", existingContactId: matches[0].id };
      if (matches.length > 1 && !decision) {
        return await conflictWithCleanup(supabase, uploadedPaths, `Un doublon possible existe pour ${personName(person)}. Choisis « Utiliser cette fiche » ou « Créer quand même » avant de confirmer.`);
      }
      if (existingMergeContext && !decision && !matches.length) {
        return await conflictWithCleanup(supabase, uploadedPaths, `Indique à qui appartient le document de ${personName(person)} dans « ${existingMergeContext.title} », ou confirme explicitement la création d’une nouvelle personne.`);
      }

      let contact: ContactRow | undefined;
      if (decision?.action === "use") {
        contact = contacts.find((match) => match.id === decision.existingContactId);
        if (!contact) return await conflictWithCleanup(supabase, uploadedPaths, `La fiche choisie pour ${personName(person)} n’est plus disponible. Relance l’analyse.`);
      } else if (matches.length && decision?.action !== "create") {
        return await conflictWithCleanup(supabase, uploadedPaths, `La création d’un doublon pour ${personName(person)} exige une confirmation explicite.`);
      }

      const roles = crmRoles(person, analysis.projectType);
      if (contact) {
        const updates: Record<string, unknown> = { roles: [...new Set([...(contact.roles || []), ...roles])], updated_at: new Date().toISOString() };
        if (!contact.email && person.email) updates.email = person.email;
        if (!contact.phone && person.phone) updates.phone = person.phone;
        if (!contact.mailing_address && person.mailingAddress) updates.mailing_address = person.mailingAddress;
        const { error } = await supabase.from("clients").update(updates).eq("id", contact.id).eq("user_id", user.id);
        if (error) throw error;
        contactIds.set(person.id, contact.id);
        reusedContacts.push(personName(person));
        continue;
      }

      const { data, error } = await supabase.from("clients").insert({
        user_id: user.id,
        first_name: person.firstName.trim(),
        last_name: person.lastName.trim(),
        email: person.email.trim() || null,
        phone: person.phone.trim() || null,
        mailing_address: person.mailingAddress.trim() || null,
        roles,
      }).select("id,first_name,last_name,email,phone,mailing_address,roles").single();
      if (error || !data) throw error || new Error("Création de la fiche client impossible.");
      contacts.push(data as ContactRow);
      contactIds.set(person.id, data.id);
      createdContacts.push(personName(person));
    }

    // Property identity is resolved only after all people have been linked.
    let propertyId: string | null = existingMergeContext?.propertyId || null;
    let reusedProperty = Boolean(propertyId);
    if (analysis.property.address && !propertyId) {
      const { data: properties, error } = await supabase.from("properties").select("id,address,city").eq("user_id", user.id);
      if (error) throw error;
      const duplicate = (properties || []).find((property) =>
        normalizeUniversalValue(property.address) === normalizeUniversalValue(analysis.property.address)
        && normalizeUniversalValue(property.city) === normalizeUniversalValue(analysis.property.city));
      if (duplicate) {
        propertyId = duplicate.id;
        reusedProperty = true;
      } else {
        const { data, error: insertError } = await supabase.from("properties").insert({
          user_id: user.id,
          address: analysis.property.address,
          city: analysis.property.city,
          postal_code: analysis.property.postalCode || null,
          property_type: analysis.property.propertyType || analysis.buyerCriteria.propertyType || null,
          lot_number: analysis.property.lotNumber || null,
        }).select("*").single();
        if (insertError || !data) throw insertError || new Error("Création de la propriété impossible.");
        propertyId = data.id;
      }
    }

    const sellerPeople = analysis.people.filter((person) => person.roles.some((role) => role === "seller" || role === "owner"));
    const buyerPeople = analysis.people.filter((person) => person.roles.includes("buyer"));
    const sellerContactIds = (sellerPeople.length ? sellerPeople : analysis.projectType === "seller" ? analysis.people : []).map((person) => contactIds.get(person.id)).filter((id): id is string => Boolean(id));
    const buyerContactIds = (buyerPeople.length ? buyerPeople : analysis.projectType === "buyer" ? analysis.people : []).map((person) => contactIds.get(person.id)).filter((id): id is string => Boolean(id));

    let listingId: string | null = existingMergeContext?.sellerListingId || null;
    let buyerCaseId: string | null = existingMergeContext?.buyerCaseId || null;
    let reusedListing = Boolean(listingId);
    let reusedBuyerCase = Boolean(buyerCaseId);

    if (analysis.projectType === "seller" || analysis.projectType === "buy_sell") {
      if (!propertyId || !sellerContactIds.length) throw new Error("Le dossier vendeur exige une propriété et au moins un client vendeur relié.");
      if (!listingId) {
        const { data: existing } = await supabase.from("seller_listings").select("id").eq("user_id", user.id).eq("property_id", propertyId).in("status", ["draft", "review", "prepared", "published"]).limit(1).maybeSingle();
        listingId = existing?.id || null;
        reusedListing = Boolean(listingId);
      }
      if (!listingId) {
        const { data, error } = await supabase.from("seller_listings").insert({ user_id: user.id, property_id: propertyId, status: "review", pipeline_stage: "lead", validation_required: true }).select("id").single();
        if (error || !data) throw error || new Error("Création du dossier vendeur impossible.");
        listingId = data.id;
      }
      const { error: partiesError } = await supabase.from("seller_listing_parties").upsert(sellerContactIds.map((contactId) => ({ user_id: user.id, listing_id: listingId, contact_id: contactId, role: "seller" })), { onConflict: "listing_id,contact_id,role" });
      if (partiesError) throw partiesError;
    }

    if (analysis.projectType === "buyer" || analysis.projectType === "buy_sell") {
      const primaryContactId = buyerContactIds[0] || contactIds.values().next().value as string | undefined;
      if (!primaryContactId) throw new Error("Le dossier acheteur exige au moins un client acheteur relié.");
      let existing: Record<string, any> | null = existingMergeContext?.buyer || null;
      if (!buyerCaseId) {
        const result = await supabase.from("buyer_cases").select("*").eq("user_id", user.id).eq("contact_id", primaryContactId).neq("status", "completed").limit(1).maybeSingle();
        if (result.error) throw result.error;
        existing = result.data;
        buyerCaseId = existing?.id || null;
        reusedBuyerCase = Boolean(buyerCaseId);
      }
      const criteria = analysis.buyerCriteria;
      if (!buyerCaseId) {
        const { data, error } = await supabase.from("buyer_cases").insert({
          user_id: user.id, contact_id: primaryContactId, property_id: propertyId, source: "document",
          status: "qualification", pipeline_stage: "qualification",
          budget: criteria.budget || null, preapproval_status: criteria.preapprovalStatus || "missing", sectors: criteria.sectors,
          property_type: criteria.propertyType || analysis.property.propertyType || null, bedrooms: criteria.bedrooms || null,
          important_needs: criteria.importantNeeds || null, timeline: criteria.timeline || null,
          property_to_sell: criteria.propertyToSell, validation_required: true,
        }).select("*").single();
        if (error || !data) throw error || new Error("Création du dossier acheteur impossible.");
        buyerCaseId = data.id;
      } else if (!existingMergeContext) {
        const enrichOnly: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (!existing?.property_id && propertyId) enrichOnly.property_id = propertyId;
        if (!existing?.budget && criteria.budget) enrichOnly.budget = criteria.budget;
        if ((!existing?.preapproval_status || existing.preapproval_status === "missing") && criteria.preapprovalStatus !== "missing") enrichOnly.preapproval_status = criteria.preapprovalStatus;
        if ((!existing?.sectors || !existing.sectors.length) && criteria.sectors.length) enrichOnly.sectors = criteria.sectors;
        if (!existing?.property_type && (criteria.propertyType || analysis.property.propertyType)) enrichOnly.property_type = criteria.propertyType || analysis.property.propertyType;
        if (!existing?.bedrooms && criteria.bedrooms) enrichOnly.bedrooms = criteria.bedrooms;
        if (!existing?.important_needs && criteria.importantNeeds) enrichOnly.important_needs = criteria.importantNeeds;
        if (!existing?.timeline && criteria.timeline) enrichOnly.timeline = criteria.timeline;
        if (existing?.property_to_sell == null && criteria.propertyToSell != null) enrichOnly.property_to_sell = criteria.propertyToSell;
        const { error } = await supabase.from("buyer_cases").update(enrichOnly).eq("id", buyerCaseId).eq("user_id", user.id);
        if (error) throw error;
      }
      const partyIds = buyerContactIds.length ? buyerContactIds : [primaryContactId];
      const { error: partiesError } = await supabase.from("buyer_case_parties").upsert(partyIds.map((contactId) => ({ user_id: user.id, case_id: buyerCaseId, contact_id: contactId, role: "buyer" })), { onConflict: "case_id,contact_id,role" });
      if (partiesError) throw partiesError;
    }

    const sellerDocumentIds = new Map<string, string>();
    const buyerDocumentIds = new Map<string, string>();

    if (buyerCaseId) {
      const { error } = await supabase.from("buyer_cases").update({ status: technicalBuyerStatus(analysis.buyerStage), pipeline_stage: analysis.buyerStage || "qualification", updated_at: new Date().toISOString() }).eq("id", buyerCaseId).eq("user_id", user.id);
      if (error) throw error;
    }
    if (listingId) {
      const { error } = await supabase.from("seller_listings").update({ pipeline_stage: analysis.sellerStage || "lead", updated_at: new Date().toISOString() }).eq("id", listingId).eq("user_id", user.id);
      if (error) throw error;
    }

    const primaryClientId = buyerContactIds[0] || sellerContactIds[0] || contactIds.values().next().value as string | undefined;
    if (!primaryClientId) throw new Error("Aucun client central n’a pu être relié au dossier.");
    const clientName = analysis.people.map(personName).filter(Boolean).join(" et ") || "Client";
    const centralCaseId = await ensureCentralCase(supabase, {
      userId: user.id, primaryClientId, participantIds: [...sellerContactIds, ...buyerContactIds], propertyId,
      caseType: existingMergeContext?.caseType || (analysis.projectType === "unknown" ? "other" : analysis.projectType),
      title: existingMergeContext?.title || (analysis.projectType === "seller" ? `Vente — ${analysis.property.address || clientName}` : analysis.projectType === "buyer" ? `Achat — ${clientName}` : analysis.projectType === "buy_sell" ? `Achat + vente — ${clientName}` : `Projet — ${clientName}`),
      status: "active", pipelineStage: analysis.buyerStage || analysis.sellerStage || "new_contact", source: "universal_import",
      buyerCaseId, sellerListingId: listingId, centralCaseId: existingMergeContext?.id || null,
    });

    // Le dossier et le pipeline existent avant les étapes opérationnelles.
    let partnersLinked = 0;
    if (buyerCaseId && !reusedBuyerCase) {
      await persistBuyerFinancing(supabase, user.id, buyerCaseId, analysis, buyerDocumentIds);
    }
    if (buyerCaseId) partnersLinked = await linkBuyerPartners(supabase, user.id, buyerCaseId, analysis);
    if (listingId) await ensureSellerTasks(supabase, user.id, listingId, analysis);
    if (buyerCaseId) await ensureBuyerTasks(supabase, user.id, buyerCaseId, analysis);

    const centralDocumentIds = new Map<string, string>();
    for (const item of stored) {
      const source = analysis.sources.find((candidate) => candidate.name === item.file.name);
      const isSensitive = source?.type === "Pièce d’identité";
      const subjectClientId = documentSubjectClientId(item.file.name, analysis, contactIds) || primaryClientId;
      const metadata = { confidence: source?.confidence, pageCount: source?.pageCount, analysisMode: source?.analysisMode, importId, isSensitive };
      if (listingId) {
        const { data, error } = await supabase.from("seller_listing_documents").insert({
          user_id: user.id, listing_id: listingId, name: item.file.name, document_type: source?.type || "Autre",
          mime_type: normalizedMime(item.file), size_bytes: item.file.size, storage_path: item.path,
          source_type: source?.sourceType || "image", analysis_metadata: metadata, analysis_status: "analyzed",
        }).select("*").single();
        if (error || !data) throw error || new Error(`Le document ${item.file.name} n’a pas pu être relié au dossier vendeur.`);
        sellerDocumentIds.set(item.file.name, data.id);
        const centralId = await syncCentralDocument(supabase, { userId: user.id, clientId: subjectClientId, caseId: centralCaseId, propertyId, document: { ...data, source_type: source?.sourceType || "image", analysis_metadata: metadata, is_sensitive: isSensitive, subject_client_id: subjectClientId }, legacySource: "seller_listing_documents" });
        centralDocumentIds.set(item.file.name, centralId);
      }
      if (buyerCaseId) {
        const { data, error } = await supabase.from("buyer_case_documents").insert({
          user_id: user.id, case_id: buyerCaseId, name: item.file.name, document_type: source?.type || "Autre",
          mime_type: normalizedMime(item.file), size_bytes: item.file.size, storage_path: item.path,
          source_type: source?.sourceType || "image", analysis_metadata: metadata, analysis_status: "analyzed",
        }).select("*").single();
        if (error || !data) throw error || new Error(`Le document ${item.file.name} n’a pas pu être relié au dossier acheteur.`);
        buyerDocumentIds.set(item.file.name, data.id);
        const centralId = await syncCentralDocument(supabase, { userId: user.id, clientId: subjectClientId, caseId: centralCaseId, propertyId, document: { ...data, source_type: source?.sourceType || "image", analysis_metadata: metadata, is_sensitive: isSensitive, subject_client_id: subjectClientId }, legacySource: "buyer_case_documents" });
        if (!centralDocumentIds.has(item.file.name)) centralDocumentIds.set(item.file.name, centralId);
      }
      if (!listingId && !buyerCaseId) {
        const { data, error } = await supabase.from("documents").insert({
          user_id: user.id, client_id: subjectClientId, subject_client_id: subjectClientId, case_id: centralCaseId,
          property_id: propertyId, name: item.file.name, category: source?.type || "Autre", mime_type: normalizedMime(item.file),
          size_bytes: item.file.size, storage_path: item.path, source_type: source?.sourceType || "image",
          analysis_status: "analyzed", analysis_metadata: metadata, is_sensitive: isSensitive,
        }).select("id").single();
        if (error || !data) throw error || new Error(`Le document ${item.file.name} n’a pas pu être relié au dossier central.`);
        centralDocumentIds.set(item.file.name, data.id);
      }
    }

    if (buyerCaseId && !reusedBuyerCase) await persistBuyerFinancing(supabase, user.id, buyerCaseId, analysis, buyerDocumentIds);
    if (listingId) await ensureSellerAutomations(supabase, user.id, listingId, analysis);
    if (buyerCaseId) await ensureBuyerAutomations(supabase, user.id, buyerCaseId, analysis);
    await syncCentralWorkflow(supabase, { userId: user.id, clientId: primaryClientId, caseId: centralCaseId, buyerCaseId, sellerListingId: listingId });

    if (listingId) await insertSellerFacts(supabase, user.id, listingId, analysis, sellerDocumentIds);
    if (buyerCaseId) await insertBuyerFacts(supabase, user.id, buyerCaseId, analysis, buyerDocumentIds);

    const mergeContext = existingMergeContext || await loadContinuousMergeContext(supabase, user.id, centralCaseId);
    const effectivePersonDecisions: PersonDecision[] = analysis.people.map((person) => ({
      personId: person.id, action: "use", existingContactId: contactIds.get(person.id),
    }));
    const mergeResult = await applyContinuousMerge(supabase, {
      userId: user.id, analysis, context: mergeContext, personDecisions: effectivePersonDecisions,
      mergeDecisions, centralDocumentIds,
    });

    if (listingId) await supabase.from("seller_listing_activity").insert({ user_id: user.id, listing_id: listingId, event_type: "universal_import_confirmed", title: "Import intelligent confirmé", details: analysis.coachSummary });
    if (buyerCaseId) await supabase.from("buyer_case_activity").insert({ user_id: user.id, case_id: buyerCaseId, event_type: "universal_import_confirmed", title: "Import intelligent confirmé", details: analysis.coachSummary });
    await recordCentralActivity(supabase, {
      userId: user.id, clientId: primaryClientId, caseId: centralCaseId, eventType: "document_enrichment_completed",
      title: `${stored.map((item) => item.file.name).join(", ")} analysé${stored.length > 1 ? "s" : ""}`,
      details: `${mergeResult.added} information(s) ajoutée(s), ${mergeResult.confirmed} confirmée(s), ${mergeResult.conflicts} conflit(s) traité(s). Dossier prêt à ${mergeResult.progress} %.`,
    });

    const primaryHref = `/tableau-de-bord/dossiers/${centralCaseId}`;
    return NextResponse.json({
      ok: true, listingId, buyerCaseId, centralCaseId, primaryHref, createdContacts, reusedContacts, reusedProperty,
      reusedListing, reusedBuyerCase, uploadedFiles: stored.length, partnersLinked,
      merge: mergeResult, summary: `${analysis.coachSummary} ${mergeResult.added} information(s) ajoutée(s); dossier prêt à ${mergeResult.progress} %.`
    });
  } catch (error) {
    console.error("[universal-import/confirm]", error);
    try {
      if (uploadedPaths.length) {
        const supabase = await createSupabaseServerClient();
        await supabase.storage.from("seller-listing-files").remove(uploadedPaths);
      }
    } catch { /* the original error remains the useful one */ }
    return NextResponse.json({ error: error instanceof Error ? error.message : "La création du dossier a échoué." }, { status: error instanceof MergeValidationError ? 409 : 500 });
  }
}

function validateConfirmation(analysis: UniversalAnalysis, files: File[], enrichingExistingCase = false) {
  if (analysis.projectType === "unknown") return "Le type de projet doit être confirmé : vendeur, acheteur, achat + vente, prospect ou autre.";
  if (!analysis.people.length) return "Ajoute ou confirme au moins une personne réelle avant de créer le dossier.";
  if (analysis.people.some((person) => !person.firstName && !person.lastName)) return "Chaque personne doit avoir un nom avant la confirmation.";
  if (!enrichingExistingCase && (analysis.projectType === "seller" || analysis.projectType === "buy_sell") && (!analysis.property.address || !analysis.property.city)) return "L’adresse et la ville sont requises pour le dossier vendeur.";
  if (!files.length || files.length > MAX_FILES) return `Entre 1 et ${MAX_FILES} fichiers analysés sont requis.`;
  for (const file of files) {
    if (!ALLOWED_EXTENSIONS.has(fileExtension(file.name))) return `Format non accepté pour ${file.name}.`;
    if (file.size > MAX_FILE_BYTES) return `${file.name} dépasse 15 Mo.`;
  }
  return null;
}

function isDuplicate(person: UniversalPerson, contact: ContactRow) {
  const email = normalizeUniversalValue(person.email);
  const phone = person.phone.replace(/\D/g, "");
  const name = normalizeUniversalValue(`${person.firstName}${person.lastName}`);
  return Boolean(
    (email && email === normalizeUniversalValue(contact.email))
    || (phone && phone === (contact.phone || "").replace(/\D/g, ""))
    || (name && name === normalizeUniversalValue(`${contact.first_name}${contact.last_name}`)),
  );
}

function crmRoles(person: UniversalPerson, projectType: UniversalAnalysis["projectType"]) {
  const roles: string[] = person.roles.map((role) => role === "owner" ? "seller" : role);
  if (!roles.length && projectType === "seller") roles.push("seller");
  if (!roles.length && projectType === "buyer") roles.push("buyer");
  if (!roles.length && projectType === "buy_sell") roles.push("seller", "buyer");
  if (!roles.length && (projectType === "prospect" || projectType === "other")) roles.push("prospect");
  return [...new Set(roles)];
}

async function persistBuyerFinancing(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, caseId: string, analysis: UniversalAnalysis, documents: Map<string, string>) {
  const criteria = analysis.buyerCriteria;
  const prequalificationSource = analysis.sources.find((source) => source.type === "Préapprobation");
  const hasFinancing = Boolean(prequalificationSource || criteria.preapprovalStatus !== "missing" || criteria.downPayment || criteria.mortgageAmount || criteria.lender);
  if (!hasFinancing) return;
  const { error } = await supabase.from("buyer_financing").upsert({
    user_id: userId,
    case_id: caseId,
    status: criteria.preapprovalStatus || "missing",
    maximum_purchase_price: moneyValue(criteria.budget),
    down_payment: moneyValue(criteria.downPayment),
    mortgage_amount: moneyValue(criteria.mortgageAmount),
    occupancy_type: criteria.occupancyType || null,
    lender: criteria.lender || null,
    preapproval_date: isoDate(criteria.preapprovalDate),
    expiry_date: isoDate(criteria.expiryDate),
    source_document_id: prequalificationSource ? documents.get(prequalificationSource.name) || null : null,
    raw_data: criteria,
    updated_at: new Date().toISOString(),
  }, { onConflict: "case_id" });
  if (error) throw error;
}

async function linkBuyerPartners(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, caseId: string, analysis: UniversalAnalysis) {
  if (!analysis.partners.length) return 0;
  const { data: existing, error: readError } = await supabase.from("partners").select("id,first_name,last_name,organization,email,phone,partner_type").eq("user_id", userId);
  if (readError) throw readError;
  let linked = 0;
  for (const partner of analysis.partners) {
    const match = (existing || []).find((candidate) => {
      const email = normalizeUniversalValue(partner.email);
      const phone = partner.phone.replace(/\D/g, "");
      const name = normalizeUniversalValue(`${partner.firstName}${partner.lastName}`);
      return Boolean((email && email === normalizeUniversalValue(candidate.email)) || (phone && phone === (candidate.phone || "").replace(/\D/g, "")) || (name && name === normalizeUniversalValue(`${candidate.first_name}${candidate.last_name}`)));
    });
    let partnerId: string | undefined;
    if (match) {
      partnerId = match.id;
      const { error } = await supabase.from("partners").update({
        organization: match.organization || partner.organization || null,
        email: match.email || partner.email || null,
        phone: match.phone || partner.phone || null,
        partner_type: match.partner_type === "other" ? partner.partnerType : match.partner_type,
        updated_at: new Date().toISOString(),
      }).eq("id", partnerId).eq("user_id", userId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("partners").insert({
        user_id: userId, first_name: partner.firstName, last_name: partner.lastName,
        organization: partner.organization || null, email: partner.email || null, phone: partner.phone || null,
        partner_type: partner.partnerType,
      }).select("id").single();
      if (error || !data) throw error || new Error("Création du partenaire impossible.");
      partnerId = data.id;
    }
    const { error: linkError } = await supabase.from("buyer_case_partners").upsert({ user_id: userId, case_id: caseId, partner_id: partnerId, role: partner.partnerType }, { onConflict: "case_id,partner_id,role", ignoreDuplicates: true });
    if (linkError) throw linkError;
    linked += 1;
  }
  return linked;
}

function moneyValue(value: string) {
  if (!value.trim()) return null;
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function isoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function technicalBuyerStatus(stage: string | null) {
  const allowed = new Set(["qualification", "financing", "active_search", "visits", "offer", "conditions", "notary", "completed"]);
  if (stage === "representation_agreement") return "active_search";
  return stage && allowed.has(stage) ? stage : "qualification";
}

async function ensureSellerTasks(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, listingId: string, analysis: UniversalAnalysis) {
  const { data: existingTasks, error: taskReadError } = await supabase.from("seller_listing_tasks").select("title").eq("listing_id", listingId).eq("user_id", userId);
  if (taskReadError) throw taskReadError;
  const existingTitles = new Set((existingTasks || []).map((task) => task.title));
  const taskTemplates = [...SELLER_TASK_TEMPLATES, ...analysis.suggestedTasks.map((title) => ({ category: "import", title }))];
  const missingTasks = taskTemplates.filter((task) => !existingTitles.has(task.title));
  if (missingTasks.length) {
    const { error } = await supabase.from("seller_listing_tasks").insert(missingTasks.map((task) => ({ user_id: userId, listing_id: listingId, category: task.category, title: task.title, validation_required: true })));
    if (error) throw error;
  }
}

async function ensureSellerAutomations(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, listingId: string, analysis: UniversalAnalysis) {
  const names = [...new Set([...SELLER_AUTOMATION_TEMPLATES, ...analysis.suggestedAutomations])];
  const { error } = await supabase.from("seller_listing_automations").upsert(names.map((name) => ({ user_id: userId, listing_id: listingId, name, status: "validation_required", external_delivery_enabled: false })), { onConflict: "listing_id,name", ignoreDuplicates: true });
  if (error) throw error;
}

async function ensureBuyerTasks(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, caseId: string, analysis: UniversalAnalysis) {
  const { data: existingTasks, error: taskReadError } = await supabase.from("buyer_case_tasks").select("title").eq("case_id", caseId).eq("user_id", userId);
  if (taskReadError) throw taskReadError;
  const existingTitles = new Set((existingTasks || []).map((task) => task.title));
  const taskTemplates = [...BUYER_TASK_TEMPLATES, ...analysis.suggestedTasks.map((title) => ({ category: "import", title }))];
  const missingTasks = taskTemplates.filter((task) => !existingTitles.has(task.title));
  if (missingTasks.length) {
    const { error } = await supabase.from("buyer_case_tasks").insert(missingTasks.map((task) => ({ user_id: userId, case_id: caseId, category: task.category, title: task.title, validation_required: true })));
    if (error) throw error;
  }
}

async function ensureBuyerAutomations(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, caseId: string, analysis: UniversalAnalysis) {
  const names = [...new Set([...BUYER_AUTOMATION_TEMPLATES, ...analysis.suggestedAutomations])];
  const { error } = await supabase.from("buyer_case_automations").upsert(names.map((name) => ({ user_id: userId, case_id: caseId, name, status: "validation_required", external_delivery_enabled: false })), { onConflict: "case_id,name", ignoreDuplicates: true });
  if (error) throw error;
}

async function insertSellerFacts(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, listingId: string, analysis: UniversalAnalysis, documents: Map<string, string>) {
  const { data: existing, error: readError } = await supabase.from("seller_listing_facts").select("fact_key,value,source_label").eq("listing_id", listingId).eq("user_id", userId);
  if (readError) throw readError;
  const rows = analysis.facts.filter((fact) => !(existing || []).some((item) => item.fact_key === fact.field && item.value === fact.value && item.source_label === fact.sourceName)).map((fact) => ({
    user_id: userId, listing_id: listingId, fact_key: fact.field, label: fact.label, value: fact.value,
    status: fact.status, source_document_id: documents.get(fact.sourceName) || null, source_label: fact.sourceName,
    source_type: fact.sourceType, confidence: fact.confidence, note: fact.note || null,
  }));
  if (rows.length) { const { error } = await supabase.from("seller_listing_facts").insert(rows); if (error) throw error; }
}

async function insertBuyerFacts(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, caseId: string, analysis: UniversalAnalysis, documents: Map<string, string>) {
  const { data: existing, error: readError } = await supabase.from("buyer_case_facts").select("fact_key,value,source_label").eq("case_id", caseId).eq("user_id", userId);
  if (readError) throw readError;
  const rows = analysis.facts.filter((fact) => !(existing || []).some((item) => item.fact_key === fact.field && item.value === fact.value && item.source_label === fact.sourceName)).map((fact) => ({
    user_id: userId, case_id: caseId, fact_key: fact.field, label: fact.label, value: fact.value,
    status: fact.status, source_document_id: documents.get(fact.sourceName) || null, source_label: fact.sourceName,
    source_type: fact.sourceType, confidence: fact.confidence, note: fact.note || null,
  }));
  if (rows.length) { const { error } = await supabase.from("buyer_case_facts").insert(rows); if (error) throw error; }
}

async function conflictWithCleanup(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, paths: string[], message: string) {
  if (paths.length) await supabase.storage.from("seller-listing-files").remove(paths);
  return NextResponse.json({ error: message }, { status: 409 });
}

function parseFormJson(value: FormDataEntryValue | null, message: string) {
  if (typeof value !== "string") throw new Error(message);
  try { return JSON.parse(value) as unknown; } catch { throw new Error(message); }
}

function normalizedMime(file: File) {
  if (file.type) return file.type.toLowerCase();
  const extension = fileExtension(file.name);
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".heic") return "image/heic";
  if (extension === ".heif") return "image/heif";
  return "image/jpeg";
}

function safeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "document";
}

function documentSubjectClientId(sourceName: string, analysis: UniversalAnalysis, contactIds: Map<string, string>) {
  const candidates = analysis.people.filter((person) => person.sourceName === sourceName).map((person) => contactIds.get(person.id)).filter((id): id is string => Boolean(id));
  return candidates.length === 1 ? candidates[0] : null;
}

function personName(person: UniversalPerson) { return `${person.firstName} ${person.lastName}`.trim() || person.email || person.phone || "cette personne"; }

