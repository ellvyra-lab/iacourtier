import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: "Vous devez être connecté." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { ok: false, error: "Aucun abonnement actif à gérer." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${req.nextUrl.origin}/tableau-de-bord/abonnement`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("[stripe/portal] error:", err);
    return NextResponse.json(
      { ok: false, error: "Impossible d'ouvrir la gestion d'abonnement." },
      { status: 503 }
    );
  }
}
