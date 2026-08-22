import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { normalizeBrokerProfile } from "@/lib/broker-profile";

export async function loadBrokerProfileForUser(
  supabase: SupabaseClient,
  user: User,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("professional_profile")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[professional-profile] Server profile load failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }

  const databaseProfile = normalizeBrokerProfile(data?.professional_profile);
  if (databaseProfile.fullName || databaseProfile.agencyName) return databaseProfile;
  return normalizeBrokerProfile(user.user_metadata?.broker_profile);
}
