import { NextResponse } from "next/server";

import { buyerProgress, normalizeClientValue } from "@/lib/buyer-cases";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  roles?: string[] | null;
  tags?: string[] | null;
  client_status?: string | null;
  updated_at: string;
};

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const contactsWithRoles = await supabase.from("clients").select("id,first_name,last_name,email,phone,mailing_address,roles,tags,client_status,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
    const contactsWithoutRoles = contactsWithRoles.error && /roles|schema cache/i.test(contactsWithRoles.error.message)
      ? await supabase.from("clients").select("id,first_name,last_name,email,phone,mailing_address,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false })
      : null;
    const contactsError = contactsWithoutRoles?.error || contactsWithRoles.error;
    if (contactsError && !contactsWithoutRoles?.data) return NextResponse.json({ error: contactsError.message }, { status: 500 });
    const contactsData = contactsWithoutRoles?.data || contactsWithRoles.data || [];

    const [partiesResult, listingsResult, buyerResult] = await Promise.all([
      supabase.from("seller_listing_parties").select("contact_id,listing_id").eq("user_id", user.id),
      supabase.from("seller_listings").select("id,status,updated_at,property:properties(address,city,property_type)").eq("user_id", user.id),
      supabase.from("buyer_cases").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    ]);

    if (partiesResult.error || listingsResult.error) {
      return NextResponse.json({ error: partiesResult.error?.message || listingsResult.error?.message }, { status: 500 });
    }

    const listings = new Map((listingsResult.data || []).map((listing) => [listing.id, listing]));
    const sellersByContact = new Map<string, unknown[]>();
    for (const party of partiesResult.data || []) {
      const listing = listings.get(party.listing_id);
      if (!listing) continue;
      sellersByContact.set(party.contact_id, [...(sellersByContact.get(party.contact_id) || []), listing]);
    }

    const buyersByContact = new Map<string, Record<string, unknown>[]>();
    if (!buyerResult.error) {
      for (const buyerCase of buyerResult.data || []) {
        buyersByContact.set(buyerCase.contact_id, [...(buyersByContact.get(buyerCase.contact_id) || []), buyerCase]);
      }
    }

    const clients = (contactsData as Contact[]).map((contact) => {
      const sellerCases = sellersByContact.get(contact.id) || [];
      const buyerCases = buyersByContact.get(contact.id) || [];
      const roles = Array.from(new Set([
        ...(contact.roles || []),
        ...(sellerCases.length ? ["seller"] : []),
        ...(buyerCases.length ? ["buyer"] : []),
      ]));
      return {
        ...contact,
        name: `${contact.first_name} ${contact.last_name}`.trim() || "Client à identifier",
        roles,
        cases: [
          ...sellerCases.map((item) => ({ type: "seller", ...(item as Record<string, unknown>) })),
          ...buyerCases.map((item) => ({ type: "buyer", progress: buyerProgress(item), ...item })),
        ],
      };
    });

    const query = normalizeClientValue(new URL(request.url).searchParams.get("q"));
    const filtered = query ? clients.filter((client) => normalizeClientValue([
      client.name,
      client.email,
      client.phone,
      client.mailing_address,
      ...client.cases.map((item) => JSON.stringify(item)),
    ].filter(Boolean).join(" ")).includes(query)) : clients;

    return NextResponse.json({
      clients: filtered,
      buyerCasesAvailable: !buyerResult.error,
      warning: buyerResult.error && /buyer_|schema cache|does not exist/i.test(buyerResult.error.message)
        ? "La migration Supabase des parcours guidés reste à appliquer."
        : undefined,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les clients et dossiers." }, { status: 500 });
  }
}
