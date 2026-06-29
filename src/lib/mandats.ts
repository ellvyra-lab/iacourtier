export type GeneratedDescription = {
  id: string;
  user_id: string;
  mandat_id?: string | null;
  property_type: string;
  city: string;
  price: string | null;
  generated_text: string;
  created_at: string;
};

export type Mandat = {
  id: string;
  user_id?: string | null;
  address: string | null;
  city: string | null;
  property_type: string | null;
  asking_price: string | null;
  mls_number: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  garage: string | null;
  parking: string | null;
  pool: string | null;
  basement: string | null;
  fireplace: string | null;
  air_conditioning: string | null;
  living_area: string | null;
  land_area: string | null;
  year_built: string | null;
  highlights: string | null;
  marketing_style: string | null;
  created_at?: string | null;
};

export function localMandatToMandat(value: Record<string, unknown>): Mandat {
  return {
    id: String(value.id || ""),
    address: String(value.address || ""),
    city: String(value.city || ""),
    property_type: String(value.property_type || value.type || "Maison"),
    asking_price: String(value.asking_price || value.price || ""),
    mls_number: String(value.mls_number || ""),
    bedrooms: String(value.bedrooms || ""),
    bathrooms: String(value.bathrooms || ""),
    garage: String(value.garage || ""),
    parking: String(value.parking || ""),
    pool: String(value.pool || ""),
    basement: String(value.basement || ""),
    fireplace: String(value.fireplace || ""),
    air_conditioning: String(value.air_conditioning || ""),
    living_area: String(value.living_area || ""),
    land_area: String(value.land_area || value.lot || ""),
    year_built: String(value.year_built || ""),
    highlights: String(value.highlights || value.description || ""),
    marketing_style: String(value.marketing_style || "Chaleureux"),
    created_at: String(value.created_at || ""),
  };
}
