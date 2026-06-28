import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { plan } = await req.json().catch(() => ({ plan: null }));

  if (!plan || !(plan in STRIPE_PRICE_IDS)) {
    return NextResponse.json({ ok: false, error: "Forfait invalide." }, { status: 400 });
  }

  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Les abonnements ne sont pas encore configurés. Contactez le support.",
      },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { ok: false, error: "Vous devez être connecté." },
      { status: 401 }
    );
  }

  try {
    const stripe = getStripe();
    const origin = req.nextUrl.origin;

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", userData.user.id)
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: profile?.stripe_customer_id || undefined,
      customer_email: profile?.stripe_customer_id ? undefined : userData.user.email,
      client_reference_id: userData.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/tableau-de-bord/abonnement?success=1`,
      cancel_url: `${origin}/tableau-de-bord/abonnement?canceled=1`,
      metadata: { user_id: userData.user.id, plan },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("[stripe/checkout] error:", err);
    return NextResponse.json(
      { ok: false, error: "Impossible de démarrer le paiement. Réessayez." },
      { status: 503 }
    );
  }
}
