"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, ExternalLink } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = {
  plan: string;
  generations_used_this_period: number;
  stripe_subscription_status: string | null;
};

const PLAN_DETAILS: Record<string, { name: string; price: string; limit: string }> = {
  gratuit: { name: "Gratuit", price: "0$/mois", limit: "10 générations / mois" },
  essentiel: { name: "Essentiel", price: "47$/mois", limit: "200 générations / mois" },
  pro: { name: "Pro", price: "97$/mois", limit: "Générations illimitées" },
};

export function SubscriptionPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("plan, generations_used_this_period, stripe_subscription_status")
        .eq("id", data.user.id)
        .single();
      if (p) setProfile(p as Profile);
    });
  }, []);

  async function handleUpgrade(plan: string) {
    setLoadingPlan(plan);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoadingPlan(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Impossible de joindre le serveur.");
      setLoadingPlan(null);
    }
  }

  async function handleManage() {
    setLoadingPlan("manage");
    setError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoadingPlan(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Impossible de joindre le serveur.");
      setLoadingPlan(null);
    }
  }

  const currentPlan = profile?.plan || "gratuit";
  const details = PLAN_DETAILS[currentPlan];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="rounded-2xl border border-subtle bg-surface-soft p-6">
        <p className="mb-1 text-sm text-muted">Forfait actuel</p>
        <p className="text-2xl font-semibold">{details?.name ?? "Gratuit"}</p>
        {profile && (
          <p className="mt-1 text-sm text-muted">
            {profile.generations_used_this_period} générations utilisées ce
            mois-ci · {details?.limit}
          </p>
        )}

        {profile?.stripe_subscription_status && currentPlan !== "gratuit" && (
          <button
            onClick={handleManage}
            disabled={loadingPlan === "manage"}
            className="mt-4 flex items-center gap-2 rounded-full border border-subtle px-4 py-2 text-sm hover:border-electric-500 hover:text-electric-500"
          >
            {loadingPlan === "manage" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ExternalLink size={14} />
            )}
            Gérer mon abonnement
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {(["essentiel", "pro"] as const).map((plan) => (
          <div
            key={plan}
            className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface p-6"
          >
            <p className="font-semibold">{PLAN_DETAILS[plan].name}</p>
            <p className="text-2xl font-semibold">{PLAN_DETAILS[plan].price}</p>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Check size={14} className="text-cyan-500" />
              {PLAN_DETAILS[plan].limit}
            </p>
            <button
              onClick={() => handleUpgrade(plan)}
              disabled={currentPlan === plan || loadingPlan === plan}
              className="mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {loadingPlan === plan && <Loader2 size={14} className="animate-spin" />}
              {currentPlan === plan ? "Forfait actuel" : "Choisir ce forfait"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
