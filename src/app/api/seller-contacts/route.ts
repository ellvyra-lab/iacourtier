import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const { data, error } = await supabase
      .from("seller_contacts")
      .select("id,first_name,last_name,email,phone,mailing_address,roles,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: databaseMessage(error.message) }, { status: 500 });
    return NextResponse.json({ contacts: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les vendeurs." }, { status: 500 });
  }
}

function databaseMessage(message: string) {
  if (/seller_contacts|schema cache|does not exist/i.test(message)) {
    return "La migration Supabase du dossier vendeur n’est pas encore appliquée.";
  }
  return message;
}
