import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { buildClientImportPlan, normalizeExistingClient, publicImportPreview } from "@/lib/client-list-import";
import { parseClientSpreadsheet } from "@/lib/server/client-spreadsheet";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);
const CONTACT_COLUMNS = "id,first_name,last_name,email,phone,mailing_address,city,postal_code,birth_date,purchase_date,sale_date,mortgage_renewal_date,client_status,source,notes,roles,tags";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    const validationError = validateFile(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const selectedFile = file as File;
    const buffer = Buffer.from(await selectedFile.arrayBuffer());
    const fingerprint = createHash("sha256").update(buffer).digest("hex");
    const table = parseClientSpreadsheet(buffer);

    const [contactsResult, historyResult] = await Promise.all([
      supabase.from("clients").select(CONTACT_COLUMNS).eq("user_id", user.id),
      supabase.from("client_imports").select("id,created_at,summary,status").eq("user_id", user.id).eq("file_hash", fingerprint).order("created_at", { ascending: false }).limit(5),
    ]);
    if (contactsResult.error) throw contactsResult.error;
    if (historyResult.error) throw historyResult.error;

    const plan = buildClientImportPlan(table, (contactsResult.data || []).map((contact) => normalizeExistingClient(contact)));
    if (!plan.mappings.length) {
      return NextResponse.json({ error: "Aucune colonne client reconnue. Ajoute au moins un nom, un courriel ou un téléphone dans les en-têtes." }, { status: 400 });
    }
    if (!plan.mappings.some((mapping) => ["firstName", "lastName", "fullName", "email", "phone"].includes(mapping.field))) {
      return NextResponse.json({ error: "Aucune colonne d’identité reconnue. Il faut un nom, un courriel ou un téléphone." }, { status: 400 });
    }

    return NextResponse.json({
      file: { name: selectedFile.name, size: selectedFile.size, fingerprint, sheetName: table.sheetName },
      previousImports: historyResult.data || [],
      preview: publicImportPreview(plan),
    });
  } catch (error) {
    console.error("[client-import/analyze]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "La liste de clients n’a pas pu être analysée." }, { status: 500 });
  }
}

function validateFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size) return "Choisis un fichier CSV, XLSX ou XLS.";
  const extension = value.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return `${value.name} n’est pas accepté. Utilise CSV, XLSX ou XLS.`;
  if (value.size > MAX_FILE_BYTES) return `${value.name} dépasse la limite de 15 Mo.`;
  return null;
}
