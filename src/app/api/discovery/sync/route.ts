import { NextResponse } from "next/server";

import { getCityOpportunities, listSupportedMunicipalities } from "@/lib/discovery";
import { persistDiscoveryResults } from "@/lib/discovery/supabase-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type SyncBody = {
  city?: string;
  cities?: string[];
  limit?: number;
  includeInactiveSources?: boolean;
};

export async function GET(request: Request) {
  const authError = requireCronSecretIfConfigured(request);
  if (authError) return authError;

  return syncCities({});
}

export async function POST(request: Request) {
  const authError = requireCronSecretIfConfigured(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => ({}))) as SyncBody;
  return syncCities(body);
}

async function syncCities(body: SyncBody) {
  const startedAt = new Date().toISOString();
  const cities = resolveCities(body);
  const results = [];

  for (const city of cities) {
    results.push(
      await getCityOpportunities(city, {
        limit: body.limit || 250,
        includeInactiveSources: body.includeInactiveSources,
      }),
    );
  }

  const supabase = createSupabaseAdminClient();
  const persisted = await persistDiscoveryResults(supabase, results);

  return NextResponse.json({
    status: "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    cities,
    persisted,
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
  });
}

function resolveCities(body: SyncBody) {
  if (body.cities?.length) return body.cities;
  if (body.city?.trim()) return [body.city.trim()];

  const envCities = process.env.DISCOVERY_CITIES?.split(",").map((city) => city.trim()).filter(Boolean);
  if (envCities?.length) return envCities;

  return listSupportedMunicipalities().map((municipality) => municipality.name);
}

function requireCronSecretIfConfigured(request: Request) {
  const secret = process.env.DISCOVERY_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return null;

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;
  const requestSecret = request.headers.get("x-cron-secret") || bearerToken || new URL(request.url).searchParams.get("secret");
  if (requestSecret === secret) return null;

  return NextResponse.json({ error: "Unauthorized discovery sync." }, { status: 401 });
}
