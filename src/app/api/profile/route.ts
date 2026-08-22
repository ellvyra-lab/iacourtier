import { NextResponse } from "next/server";

import {
  BROKER_PROFILE_ASSET_BUCKET,
  BROKER_PROFILE_ASSET_KEYS,
  brokerProfileAssetPath,
  normalizeBrokerProfile,
  type BrokerProfile,
} from "@/lib/broker-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SupabaseError = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

function logSupabaseError(operation: string, userId: string, error: SupabaseError) {
  console.error("[professional-profile] Supabase request failed", {
    operation,
    userId,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function supabaseErrorResponse(operation: string, userId: string, error: SupabaseError) {
  logSupabaseError(operation, userId, error);
  const action = operation === "profiles.select" ? "chargé depuis" : "enregistré dans";
  return NextResponse.json({
    error: `Le profil professionnel n’a pas pu être ${action} Supabase.`,
    code: error.code || "supabase_error",
    detail: error.message,
    hint: error.hint,
  }, { status: 500 });
}

function containsEmbeddedAsset(profile: BrokerProfile) {
  return BROKER_PROFILE_ASSET_KEYS.some((key) => profile[key].startsWith("data:"));
}

async function signProfileAssets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profile: BrokerProfile,
  userId: string,
) {
  const entries = BROKER_PROFILE_ASSET_KEYS
    .map((key) => ({ key, path: brokerProfileAssetPath(profile[key]) }))
    .filter((entry): entry is { key: (typeof BROKER_PROFILE_ASSET_KEYS)[number]; path: string } => Boolean(entry.path));

  if (!entries.length) return profile;

  const { data, error } = await supabase.storage
    .from(BROKER_PROFILE_ASSET_BUCKET)
    .createSignedUrls(entries.map((entry) => entry.path), 60 * 60);

  if (error) {
    logSupabaseError("storage.createSignedUrls", userId, error);
    return profile;
  }

  const signed = { ...profile };
  entries.forEach((entry, index) => {
    const signedUrl = data?.[index]?.signedUrl;
    if (signedUrl) signed[entry.key] = signedUrl;
  });
  return signed;
}

async function authenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: data.user, error };
}

export async function GET() {
  const { supabase, user, error: authError } = await authenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name,email,professional_profile,onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return supabaseErrorResponse("profiles.select", user.id, error);

  const databaseProfile = data?.professional_profile
    ? normalizeBrokerProfile(data.professional_profile)
    : null;
  const legacyProfile = normalizeBrokerProfile(user.user_metadata?.broker_profile);
  const selected = databaseProfile?.fullName || databaseProfile?.agencyName
    ? databaseProfile
    : legacyProfile.fullName || legacyProfile.agencyName
      ? legacyProfile
      : null;

  if (!selected) return NextResponse.json({ profile: null });
  selected.onboardingCompleted = Boolean(data?.onboarding_completed || selected.onboardingCompleted);
  return NextResponse.json({ profile: await signProfileAssets(supabase, selected, user.id) });
}

export async function PUT(request: Request) {
  const { supabase, user, error: authError } = await authenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { profile?: unknown } | null;
  if (!body?.profile || typeof body.profile !== "object") {
    return NextResponse.json({ error: "Le profil transmis est invalide." }, { status: 400 });
  }

  const profile = normalizeBrokerProfile(body.profile);
  if (!profile.fullName.trim() || !profile.agencyName.trim() || !profile.email.trim()) {
    return NextResponse.json({ error: "Le nom, l’agence et le courriel sont obligatoires." }, { status: 400 });
  }
  if (containsEmbeddedAsset(profile)) {
    return NextResponse.json({
      error: "Une image n’a pas été téléversée dans Supabase Storage.",
      code: "embedded_asset",
    }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name: profile.fullName,
      email: user.email || profile.email,
      professional_profile: profile,
      onboarding_completed: profile.onboardingCompleted,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select("professional_profile,onboarding_completed")
    .single();

  if (error) return supabaseErrorResponse("profiles.upsert", user.id, error);

  const saved = normalizeBrokerProfile(data.professional_profile);
  saved.onboardingCompleted = Boolean(data.onboarding_completed);
  return NextResponse.json({ profile: await signProfileAssets(supabase, saved, user.id) });
}
