import { NextResponse } from "next/server";

import {
  BUYER_AUTOMATION_TEMPLATES,
  BUYER_TASK_TEMPLATES,
  normalizeClientValue,
  type BuyerContactInput,
  type BuyerCriteriaInput,
  type BuyerSource,
} from "@/lib/buyer-cases";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  roles?: string[] | null;
};

type CreateBuyerBody = {
  existingContactId?: string;
  contact?: BuyerContactInput;
  criteria?: BuyerCriteriaInput;
  source?: BuyerSource;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    const { data, error } = await supabase
      .from("buyer_cases")
      .select("*,contact:clients(id,first_name,last_name,email,phone,mailing_address,roles)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    return NextResponse.json({ cases: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les dossiers acheteurs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as CreateBuyerBody;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    const { data: contactsData, error: contactsError } = await supabase
      .from("clients")
      .select("id,first_name,last_name,email,phone,mailing_address,roles")
      .eq("user_id", user.id);
    if (contactsError) return NextResponse.json({ error: databaseMessage(contactsError.message) }, { status: 500 });

    const contacts = (contactsData || []) as ContactRow[];
    const supplied = body.contact;
    let contact = body.existingContactId ? contacts.find((item) => item.id === body.existingContactId) : undefined;
    const duplicate = supplied ? findDuplicate(contacts, supplied) : undefined;
    if (!contact && duplicate) contact = duplicate;

    if (!contact) {
      if (!supplied || (!supplied.firstName.trim() && !supplied.lastName.trim())) {
        return NextResponse.json({ error: "Le nom de l’acheteur est requis avant de créer son dossier." }, { status: 400 });
      }
      const { data, error } = await supabase.from("clients").insert({
        user_id: user.id,
        first_name: supplied.firstName.trim(),
        last_name: supplied.lastName.trim(),
        email: supplied.email.trim() || null,
        phone: supplied.phone.trim() || null,
        mailing_address: supplied.mailingAddress.trim() || null,
        roles: ["buyer"],
      }).select("id,first_name,last_name,email,phone,mailing_address,roles").single();
      if (error || !data) return NextResponse.json({ error: databaseMessage(error?.message || "Création du client impossible.") }, { status: 500 });
      contact = data as ContactRow;
    } else {
      const nextRoles = Array.from(new Set([...(contact.roles || []), "buyer"]));
      const updates: Record<string, unknown> = { roles: nextRoles, updated_at: new Date().toISOString() };
      if (supplied) {
        if (!contact.email && supplied.email.trim()) updates.email = supplied.email.trim();
        if (!contact.phone && supplied.phone.trim()) updates.phone = supplied.phone.trim();
        if (!contact.mailing_address && supplied.mailingAddress.trim()) updates.mailing_address = supplied.mailingAddress.trim();
      }
      const { error } = await supabase.from("clients").update(updates).eq("id", contact.id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    }

    const { data: activeCase } = await supabase
      .from("buyer_cases")
      .select("id")
      .eq("user_id", user.id)
      .eq("contact_id", contact.id)
      .neq("status", "completed")
      .limit(1)
      .maybeSingle();

    const criteria = body.criteria || emptyCriteria();
    let caseId = activeCase?.id as string | undefined;
    const reusedCase = Boolean(caseId);
    if (!caseId) {
      const { data, error } = await supabase.from("buyer_cases").insert({
        user_id: user.id,
        contact_id: contact.id,
        source: body.source || "manual",
        status: criteria.preapprovalStatus && criteria.preapprovalStatus !== "missing" ? "financing" : "qualification",
        budget: criteria.budget.trim() || null,
        preapproval_status: criteria.preapprovalStatus || "missing",
        sectors: criteria.sectors.filter(Boolean),
        property_type: criteria.propertyType.trim() || null,
        bedrooms: criteria.bedrooms.trim() || null,
        important_needs: criteria.importantNeeds.trim() || null,
        timeline: criteria.timeline.trim() || null,
        property_to_sell: criteria.propertyToSell,
        validation_required: true,
      }).select("id").single();
      if (error || !data) return NextResponse.json({ error: databaseMessage(error?.message || "Création du dossier acheteur impossible.") }, { status: 500 });
      caseId = data.id;

      const [tasksResult, automationsResult] = await Promise.all([
        supabase.from("buyer_case_tasks").insert(BUYER_TASK_TEMPLATES.map((task) => ({
          user_id: user.id,
          case_id: caseId,
          category: task.category,
          title: task.title,
          validation_required: true,
        }))),
        supabase.from("buyer_case_automations").insert(BUYER_AUTOMATION_TEMPLATES.map((name) => ({
          user_id: user.id,
          case_id: caseId,
          name,
          status: "validation_required",
          external_delivery_enabled: false,
        }))),
      ]);
      const setupError = tasksResult.error || automationsResult.error;
      if (setupError) return NextResponse.json({ error: databaseMessage(setupError.message) }, { status: 500 });
    }

    await supabase.from("buyer_case_activity").insert({
      user_id: user.id,
      case_id: caseId,
      event_type: reusedCase ? "case_reused" : "case_created",
      title: reusedCase ? "Dossier acheteur existant relié" : "Dossier acheteur créé",
      details: duplicate ? "La fiche client existante a été reconnue et réutilisée; aucun doublon n’a été créé." : `Source : ${body.source || "manual"}.`,
    });

    return NextResponse.json({
      id: caseId,
      clientId: contact.id,
      reusedClient: Boolean(duplicate || body.existingContactId),
      reusedCase,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de créer le dossier acheteur." }, { status: 500 });
  }
}

function findDuplicate(contacts: ContactRow[], buyer: BuyerContactInput) {
  const email = normalizeClientValue(buyer.email);
  const phone = (buyer.phone || "").replace(/\D/g, "");
  const name = normalizeClientValue(`${buyer.firstName}${buyer.lastName}`);
  return contacts.find((contact) => {
    const existingEmail = normalizeClientValue(contact.email);
    const existingPhone = (contact.phone || "").replace(/\D/g, "");
    const existingName = normalizeClientValue(`${contact.first_name}${contact.last_name}`);
    return Boolean((email && email === existingEmail) || (phone && phone === existingPhone) || (name && name === existingName));
  });
}

function emptyCriteria(): BuyerCriteriaInput {
  return { budget: "", preapprovalStatus: "missing", sectors: [], propertyType: "", bedrooms: "", importantNeeds: "", timeline: "", propertyToSell: null };
}

function expiredSession() {
  return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
}

function databaseMessage(message: string) {
  if (/buyer_|roles|schema cache|does not exist/i.test(message)) {
    return "La migration Supabase des parcours guidés n’est pas encore appliquée.";
  }
  return message;
}
