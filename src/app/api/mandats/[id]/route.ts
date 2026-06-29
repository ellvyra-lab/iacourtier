import { NextResponse } from "next/server";

import { propertyDossiers } from "@/data/property-dossiers";
import type { Mandat } from "@/lib/mandats";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MandatRouteProps = {
  params: Promise<{ id: string }>;
};

function staticDossierToMandat(id: string): Mandat | null {
  const dossier = propertyDossiers.find((item) => item.id === id);
  if (!dossier) return null;

  return {
    id: dossier.id,
    address: dossier.address,
    city: dossier.city,
    property_type: dossier.type,
    asking_price: dossier.price,
    mls_number: null,
    bedrooms: dossier.bedrooms,
    bathrooms: dossier.bathrooms,
    garage: dossier.garage ? "Oui" : "Non",
    parking: null,
    pool: dossier.pool ? "Oui" : "Non",
    basement: dossier.characteristics.includes("Sous-sol familial") ? "Oui" : null,
    fireplace: null,
    air_conditioning: null,
    living_area: null,
    land_area: dossier.lot,
    year_built: null,
    highlights: [dossier.description, dossier.neighborhood, dossier.schools, dossier.transport, ...dossier.particularities]
      .filter(Boolean)
      .join("\n"),
    marketing_style: "Chaleureux",
    created_at: dossier.updatedAt,
  };
}

export async function GET(_request: Request, { params }: MandatRouteProps) {
  const { id } = await params;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase.from("mandats").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!error && data) return NextResponse.json({ mandat: data });
    }
  } catch {
    // Repli vers les données de démonstration si Supabase n'est pas configuré.
  }

  const fallback = staticDossierToMandat(id);
  if (!fallback) return NextResponse.json({ error: "Mandat introuvable." }, { status: 404 });

  return NextResponse.json({ mandat: fallback });
}
