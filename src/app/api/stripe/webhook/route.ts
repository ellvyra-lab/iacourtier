import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

// Stripe needs the raw, unparsed body to verify the webhook signature.
export const runtime = "nodejs";

function planFromPriceId(priceId: string | undefined): string {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ESSENTIEL) return "essentiel";
  return "gratuit";
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature || "", webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;
        if (!userId) break;

        const stripe = getStripe();
        const subscription = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription as string)
          : null;
        const priceId = subscription?.items.data[0]?.price.id;

        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription?.id,
            stripe_subscription_status: subscription?.status,
            plan: planFromPriceId(priceId),
            generations_used_this_period: 0,
            current_period_start: new Date().toISOString(),
          })
          .eq("id", userId);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id;
        const plan =
          subscription.status === "active" || subscription.status === "trialing"
            ? planFromPriceId(priceId)
            : "gratuit";

        await supabase
          .from("profiles")
          .update({
            stripe_subscription_status: subscription.status,
            plan,
          })
          .eq("stripe_customer_id", subscription.customer as string);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
