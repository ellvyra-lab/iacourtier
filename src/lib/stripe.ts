import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

// Lazily constructed so the app doesn't crash at build/import time when
// STRIPE_SECRET_KEY isn't set yet — only throws when someone actually
// tries to start a checkout or verify a webhook.
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return stripeInstance;
}

// Maps our internal plan names to the Stripe Price IDs you create in your
// Stripe Dashboard → Product catalog. Fill these in via env vars once you
// have real products — see .env.example.
export const STRIPE_PRICE_IDS: Record<string, string | undefined> = {
  essentiel: process.env.STRIPE_PRICE_ESSENTIEL,
  pro: process.env.STRIPE_PRICE_PRO,
};
