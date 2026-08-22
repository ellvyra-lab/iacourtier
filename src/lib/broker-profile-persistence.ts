"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BROKER_PROFILE_ALLOWED_IMAGE_TYPES,
  BROKER_PROFILE_ASSET_BUCKET,
  BROKER_PROFILE_ASSET_KEYS,
  BROKER_PROFILE_ASSET_LABELS,
  BROKER_PROFILE_MAX_FILE_SIZE,
  brokerProfileAssetObjectPath,
  brokerProfileAssetPath,
  brokerProfileAssetReference,
  normalizeBrokerProfile,
  type BrokerProfile,
} from "@/lib/broker-profile";

export const BROKER_PROFILE_SAVED_EVENT = "iacourtier:broker-profile-saved";

type ProfileApiPayload = {
  profile?: unknown;
  error?: string;
  code?: string;
  detail?: string;
  hint?: string;
};

function profileApiError(payload: ProfileApiPayload, fallback: string) {
  const diagnostic = [payload.code, payload.detail, payload.hint]
    .filter(Boolean)
    .join(" — ");
  return new Error(diagnostic ? `${payload.error || fallback} (${diagnostic})` : payload.error || fallback);
}

async function uploadDataUrl(
  supabase: SupabaseClient,
  userId: string,
  key: (typeof BROKER_PROFILE_ASSET_KEYS)[number],
  value: string,
) {
  const label = BROKER_PROFILE_ASSET_LABELS[key];
  const blob = await fetch(value).then((response) => response.blob());
  if (!(BROKER_PROFILE_ALLOWED_IMAGE_TYPES as readonly string[]).includes(blob.type)) {
    throw new Error(
      `Le fichier « ${label} » n’est pas dans un format accepté (JPEG, PNG, WebP, GIF ou AVIF).`,
    );
  }
  if (blob.size > BROKER_PROFILE_MAX_FILE_SIZE) {
    throw new Error(`Le fichier « ${label} » dépasse la limite de 2 Mo.`);
  }

  const path = brokerProfileAssetObjectPath(userId, key);
  const { error } = await supabase.storage
    .from(BROKER_PROFILE_ASSET_BUCKET)
    .upload(path, blob, {
      cacheControl: "3600",
      contentType: blob.type,
      upsert: true,
    });

  if (error) {
    const status = "statusCode" in error && error.statusCode
      ? ` · HTTP ${error.statusCode}`
      : "";
    throw new Error(
      `Échec du téléversement de « ${label} » dans le bucket « ${BROKER_PROFILE_ASSET_BUCKET} » `
      + `(objet « ${path} ») : ${error.name || "StorageApiError"}${status} · ${error.message}`,
    );
  }

  return brokerProfileAssetReference(path);
}

async function prepareProfileAssets(
  supabase: SupabaseClient,
  userId: string,
  profile: BrokerProfile,
) {
  const prepared = { ...profile };

  await Promise.all(BROKER_PROFILE_ASSET_KEYS.map(async (key) => {
    const value = prepared[key];
    if (!value) return;

    const existingPath = brokerProfileAssetPath(value);
    if (existingPath) {
      prepared[key] = brokerProfileAssetReference(existingPath);
      return;
    }

    if (value.startsWith("data:")) {
      prepared[key] = await uploadDataUrl(supabase, userId, key, value);
    }
  }));

  return prepared;
}

export async function loadBrokerProfileFromSupabase() {
  const response = await fetch("/api/profile", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({})) as ProfileApiPayload;
  if (!response.ok) {
    throw profileApiError(payload, "Le profil professionnel n’a pas pu être chargé.");
  }
  return payload.profile ? normalizeBrokerProfile(payload.profile) : null;
}

export async function saveBrokerProfileToSupabase({
  supabase,
  userId,
  profile,
}: {
  supabase: SupabaseClient;
  userId: string;
  profile: BrokerProfile;
}) {
  const prepared = await prepareProfileAssets(supabase, userId, profile);
  const response = await fetch("/api/profile", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: prepared }),
  });
  const payload = await response.json().catch(() => ({})) as ProfileApiPayload;
  if (!response.ok) {
    throw profileApiError(payload, "Le profil professionnel n’a pas pu être enregistré.");
  }

  const saved = normalizeBrokerProfile(payload.profile || prepared);
  window.dispatchEvent(new CustomEvent(BROKER_PROFILE_SAVED_EVENT, { detail: saved }));
  return saved;
}
