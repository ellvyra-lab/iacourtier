import { NextResponse } from "next/server";

import { DOCUMENT_TYPES } from "@/lib/seller-listings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILES = 20;
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]);
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
    const { data: listing } = await supabase.from("seller_listings").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!listing) return NextResponse.json({ error: "Dossier vendeur introuvable." }, { status: 404 });

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: "Ajoutez au moins un document." }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Un maximum de ${MAX_FILES} documents est permis par envoi.` }, { status: 400 });
    const classification = parseClassification(formData.get("documentTypes"));
    const saved: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const mime = normalizedMime(file);
      if (!ALLOWED.has(mime)) return NextResponse.json({ error: `Format non accepté pour ${file.name}.` }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} dépasse 15 Mo.` }, { status: 400 });
      const path = `${user.id}/${id}/documents/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("seller-listing-files").upload(path, await file.arrayBuffer(), { contentType: mime, upsert: false });
      if (uploadError) return NextResponse.json({ error: storageMessage(uploadError.message) }, { status: 500 });

      const documentType = classification.get(file.name) || inferDocumentType(file.name);
      const { data: document, error } = await supabase.from("seller_listing_documents").insert({
        user_id: user.id,
        listing_id: id,
        name: file.name,
        document_type: documentType,
        mime_type: mime,
        size_bytes: file.size,
        storage_path: path,
        analysis_status: "analyzed",
      }).select("*").single();
      if (error || !document) {
        await supabase.storage.from("seller-listing-files").remove([path]);
        return NextResponse.json({ error: error?.message || "Le document n’a pas pu être enregistré." }, { status: 500 });
      }
      await supabase.from("seller_listing_facts").update({ source_document_id: document.id }).eq("listing_id", id).eq("user_id", user.id).eq("source_label", file.name).is("source_document_id", null);
      saved.push(document);
    }

    await supabase.from("seller_listing_activity").insert({
      user_id: user.id,
      listing_id: id,
      event_type: "documents_uploaded",
      title: `${saved.length} document${saved.length > 1 ? "s" : ""} ajouté${saved.length > 1 ? "s" : ""}`,
      details: files.map((file) => file.name).join(", "),
    });
    await supabase.from("seller_listings").update({ updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ documents: saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Téléversement impossible." }, { status: 500 });
  }
}

function parseClassification(value: FormDataEntryValue | null) {
  const map = new Map<string, string>();
  if (typeof value !== "string") return map;
  try {
    const parsed = JSON.parse(value) as Array<{ name?: string; type?: string }>;
    parsed.forEach((item) => {
      if (item.name && item.type && (DOCUMENT_TYPES as readonly string[]).includes(item.type)) map.set(item.name, item.type);
    });
  } catch { /* le classement automatique reste optionnel */ }
  return map;
}

function inferDocumentType(name: string) {
  const value = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/certificat|localisation/.test(value)) return "Certificat de localisation";
  if (/declaration|dv/.test(value)) return "Déclaration du vendeur";
  if (/taxe.*municip/.test(value)) return "Taxes municipales";
  if (/taxe.*scol/.test(value)) return "Taxes scolaires";
  if (/hypothe|pret/.test(value)) return "Acte ou prêt hypothécaire";
  if (/inspection/.test(value)) return "Rapport d’inspection";
  if (/facture|renov/.test(value)) return "Factures de rénovations";
  if (/plan/.test(value)) return "Plans";
  if (/photo|image/.test(value)) return "Photos";
  if (/acte|vente/.test(value)) return "Acte de vente";
  if (/fiche|descript/.test(value)) return "Fiche descriptive";
  return "Autre";
}

function normalizedMime(file: File) {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.toLowerCase().split(".").pop();
  return ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "heic" ? "image/heic" : "image/jpeg";
}

function safeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "document";
}

function storageMessage(message: string) {
  if (/bucket|not found|row-level security/i.test(message)) return "Le stockage privé seller-listing-files n’est pas configuré. Appliquez la migration Supabase #043.";
  return message;
}
