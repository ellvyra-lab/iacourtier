import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]);
const MAX_FILES = 40;
const MAX_BYTES = 15 * 1024 * 1024;
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
    if (!files.length) return NextResponse.json({ error: "Ajoutez au moins une photo." }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Un maximum de ${MAX_FILES} photos est permis par envoi.` }, { status: 400 });

    const { data: positions } = await supabase.from("seller_listing_media").select("position").eq("listing_id", id).eq("user_id", user.id).order("position", { ascending: false }).limit(1);
    let position = Number(positions?.[0]?.position || -1) + 1;
    const saved: Array<Record<string, unknown>> = [];
    for (const file of files) {
      const mime = normalizedMime(file);
      if (!ALLOWED.has(mime)) return NextResponse.json({ error: `${file.name} n’est pas une image acceptée.` }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} dépasse 15 Mo.` }, { status: 400 });
      const path = `${user.id}/${id}/media/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("seller-listing-files").upload(path, await file.arrayBuffer(), { contentType: mime, upsert: false });
      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
      const { data: media, error } = await supabase.from("seller_listing_media").insert({
        user_id: user.id, listing_id: id, name: file.name, mime_type: mime, size_bytes: file.size,
        storage_path: path, category: "other", position, is_cover: false, is_virtual_staging: false,
      }).select("*").single();
      if (error || !media) {
        await supabase.storage.from("seller-listing-files").remove([path]);
        return NextResponse.json({ error: error?.message || "La photo n’a pas pu être enregistrée." }, { status: 500 });
      }
      saved.push(media);
      position += 1;
    }
    await supabase.from("seller_listing_activity").insert({
      user_id: user.id, listing_id: id, event_type: "media_uploaded",
      title: `${saved.length} photo${saved.length > 1 ? "s" : ""} ajoutée${saved.length > 1 ? "s" : ""}`,
      details: "Aucune modification matérielle ni mise en scène virtuelle n’a été appliquée.",
    });
    await supabase.from("seller_listings").update({ updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ media: saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Téléversement des photos impossible." }, { status: 500 });
  }
}

function normalizedMime(file: File) {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.toLowerCase().split(".").pop();
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "heic" ? "image/heic" : "image/jpeg";
}

function safeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "photo";
}
