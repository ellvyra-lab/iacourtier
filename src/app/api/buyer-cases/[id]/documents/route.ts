import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };
const MAX_FILES = 12;
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]);

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const { data: buyerCase } = await supabase.from("buyer_cases").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!buyerCase) return NextResponse.json({ error: "Dossier acheteur introuvable." }, { status: 404 });

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: "Ajoute au moins un document." }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Un maximum de ${MAX_FILES} documents est permis.` }, { status: 400 });

    const saved = [];
    for (const file of files) {
      const mime = normalizedMime(file);
      if (!ALLOWED.has(mime)) return NextResponse.json({ error: `Format non accepté pour ${file.name}.` }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} dépasse 15 Mo.` }, { status: 400 });
      const path = `${user.id}/buyer-cases/${id}/documents/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("seller-listing-files").upload(path, await file.arrayBuffer(), { contentType: mime, upsert: false });
      if (uploadError) return NextResponse.json({ error: storageMessage(uploadError.message) }, { status: 500 });

      const { data, error } = await supabase.from("buyer_case_documents").insert({
        user_id: user.id,
        case_id: id,
        name: file.name,
        document_type: inferType(file.name),
        mime_type: mime,
        size_bytes: file.size,
        storage_path: path,
        analysis_status: "analyzed",
      }).select("*").single();
      if (error || !data) {
        await supabase.storage.from("seller-listing-files").remove([path]);
        return NextResponse.json({ error: error?.message || "Le document n’a pas pu être enregistré." }, { status: 500 });
      }
      saved.push(data);
    }

    await supabase.from("buyer_case_activity").insert({
      user_id: user.id,
      case_id: id,
      event_type: "documents_uploaded",
      title: `${saved.length} document${saved.length > 1 ? "s" : ""} ajouté${saved.length > 1 ? "s" : ""}`,
      details: files.map((file) => file.name).join(", "),
    });

    return NextResponse.json({ documents: saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Téléversement impossible." }, { status: 500 });
  }
}

function inferType(name: string) {
  const value = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/pre.?appro|hypothe|financ/.test(value)) return "Préapprobation";
  if (/identite|permis|passeport/.test(value)) return "Pièce d’identité";
  if (/contrat/.test(value)) return "Contrat de courtage";
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
  return /bucket|not found|row-level security/i.test(message) ? "Le stockage privé des dossiers n’est pas configuré." : message;
}
