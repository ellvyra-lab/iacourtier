import { CENTRIS_DIRECT_TRANSMISSION_MESSAGE, getCentrisConnectionStatus } from "@/lib/centris/connector";
import { normalizeGeneratedContent } from "@/lib/seller-listings";

type Supabase = any;

export type CentrisPreparedField = {
  key: string;
  label: string;
  value: string;
  required: boolean;
  source: string;
  confidence: number | null;
  status: "ready" | "missing" | "to_confirm";
};

export type CentrisPreparation = {
  listingId: string;
  status: "draft" | "ready_to_validate";
  connection: ReturnType<typeof getCentrisConnectionStatus>;
  completion: number;
  canValidate: boolean;
  fields: CentrisPreparedField[];
  missingFields: string[];
  conflicts: string[];
  documents: Array<{ id: string; name: string; type: string; status: string }>;
  photos: Array<{ id: string; name: string; category: string; position: number; isCover: boolean }>;
  description: string;
  payload: Record<string, unknown>;
  sourceCount: number;
  averageConfidence: number | null;
  transmissionMessage: string;
};

export async function prepareCentrisListing(supabase: Supabase, userId: string, listingId: string): Promise<CentrisPreparation> {
  const [listingResult, factsResult, partiesResult, documentsResult, mediaResult] = await Promise.all([
    supabase.from("seller_listings").select("id,status,generated_content,property:properties(*)").eq("id", listingId).eq("user_id", userId).maybeSingle(),
    supabase.from("seller_listing_facts").select("fact_key,label,value,status,source_label,confidence").eq("listing_id", listingId).eq("user_id", userId),
    supabase.from("seller_listing_parties").select("id,role,contact:clients(first_name,last_name,email,phone)").eq("listing_id", listingId).eq("user_id", userId),
    supabase.from("seller_listing_documents").select("id,name,document_type,analysis_status").eq("listing_id", listingId).eq("user_id", userId).order("created_at"),
    supabase.from("seller_listing_media").select("id,name,category,position,is_cover").eq("listing_id", listingId).eq("user_id", userId).order("position"),
  ]);
  const error = listingResult.error || factsResult.error || partiesResult.error || documentsResult.error || mediaResult.error;
  if (error) throw error;
  if (!listingResult.data) throw new Error("Dossier vendeur introuvable.");

  const property = Array.isArray(listingResult.data.property) ? listingResult.data.property[0] : listingResult.data.property;
  const facts = factsResult.data || [];
  const generated = normalizeGeneratedContent(listingResult.data.generated_content);
  const fact = (key: string) => facts.find((item: any) => item.fact_key === key);
  const propertyValue = (key: string) => {
    const values: Record<string, unknown> = {
      address: property?.address, city: property?.city, postalCode: property?.postal_code,
      propertyType: property?.property_type, lotNumber: property?.lot_number,
    };
    return String(values[key] || fact(key)?.value || "").trim();
  };
  const makeField = (key: string, label: string, value: string, required = false): CentrisPreparedField => {
    const sourceFact = fact(key);
    const status = !value ? "missing" : sourceFact?.status === "to_confirm" ? "to_confirm" : "ready";
    return {
      key, label, value, required, status,
      source: sourceFact?.source_label || (value ? "Fiche propriété" : "Aucune source"),
      confidence: sourceFact?.confidence == null ? null : Number(sourceFact.confidence),
    };
  };

  const fields = [
    makeField("address", "Adresse", propertyValue("address"), true),
    makeField("city", "Ville", propertyValue("city"), true),
    makeField("postalCode", "Code postal", propertyValue("postalCode")),
    makeField("propertyType", "Type de propriété", propertyValue("propertyType"), true),
    makeField("askingPrice", "Prix demandé", String(fact("askingPrice")?.value || ""), true),
    makeField("bedrooms", "Chambres", String(fact("bedrooms")?.value || "")),
    makeField("bathrooms", "Salles de bain", String(fact("bathrooms")?.value || "")),
    makeField("livingArea", "Superficie habitable", String(fact("livingArea")?.value || "")),
    makeField("landArea", "Superficie du terrain", String(fact("landArea")?.value || "")),
    makeField("yearBuilt", "Année de construction", String(fact("yearBuilt")?.value || "")),
    makeField("publicDescription", "Description publique", generated.listing.publicDescription, true),
  ];
  const missingFields = fields.filter((field) => field.required && field.status === "missing").map((field) => field.label);
  const conflicts = fields.filter((field) => field.status === "to_confirm").map((field) => field.label);
  const required = fields.filter((field) => field.required);
  const readyRequired = required.filter((field) => field.status === "ready").length;
  const photos = (mediaResult.data || []).map((item: any) => ({
    id: item.id, name: item.name, category: item.category, position: Number(item.position || 0), isCover: Boolean(item.is_cover),
  }));
  const completion = Math.round(((readyRequired / Math.max(1, required.length)) * 0.8 + (photos.length ? 0.15 : 0) + ((documentsResult.data || []).length ? 0.05 : 0)) * 100);
  const confidences = fields.map((field) => field.confidence).filter((value): value is number => value !== null);
  const sellers = (partiesResult.data || []).map((party: any) => {
    const contact = Array.isArray(party.contact) ? party.contact[0] : party.contact;
    return contact ? { role: party.role, name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(), email: contact.email || "", phone: contact.phone || "" } : null;
  }).filter(Boolean);

  return {
    listingId,
    status: missingFields.length || conflicts.length ? "draft" : "ready_to_validate",
    connection: getCentrisConnectionStatus(),
    completion: Math.min(100, completion),
    canValidate: missingFields.length === 0 && conflicts.length === 0,
    fields,
    missingFields,
    conflicts,
    documents: (documentsResult.data || []).map((item: any) => ({ id: item.id, name: item.name, type: item.document_type, status: item.analysis_status })),
    photos,
    description: generated.listing.publicDescription,
    payload: {
      listingId,
      sellers,
      property: Object.fromEntries(fields.filter((field) => field.key !== "publicDescription").map((field) => [field.key, field.value || null])),
      description: generated.listing.publicDescription,
      highlights: generated.listing.highlights,
      photos: photos.map((photo) => ({ name: photo.name, category: photo.category, position: photo.position, isCover: photo.isCover })),
    },
    sourceCount: new Set(facts.map((item: any) => item.source_label).filter(Boolean)).size,
    averageConfidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null,
    transmissionMessage: CENTRIS_DIRECT_TRANSMISSION_MESSAGE,
  };
}
