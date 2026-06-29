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
