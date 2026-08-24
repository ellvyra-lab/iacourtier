import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  CLIENT_IMPORT_TAGS,
  buildClientImportPlan,
  contactDatabaseRow,
  mergeClientData,
  normalizeExistingClient,
  type ClientImportData,
  type ClientImportGroup,
  type ImportRow,
} from "@/lib/client-list-import";
import { parseClientSpreadsheet } from "@/lib/server/client-spreadsheet";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type DuplicateAction = "merge" | "keep" | "ignore";
type AmbiguousAction = DuplicateAction | "review";
type Decisions = { certainAction: DuplicateAction; ambiguousAction: AmbiguousAction; enabledTags: string[] };
type Audit = { contact_id: string | null; row_numbers: number[]; outcome: string; warnings: string[] };

const CONTACT_COLUMNS = "id,first_name,last_name,email,phone,mailing_address,city,postal_code,birth_date,purchase_date,sale_date,mortgage_renewal_date,client_status,source,notes,roles,tags";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);

export async function POST(request: Request) {
  let importId = "";
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Le fichier à confirmer est absent." }, { status: 400 });
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(extension)) return NextResponse.json({ error: `${file.name} n’est pas accepté. Utilise CSV, XLSX ou XLS.` }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: `${file.name} dépasse la limite de 15 Mo.` }, { status: 400 });
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fingerprint = createHash("sha256").update(fileBuffer).digest("hex");
    if (fingerprint !== String(formData.get("fingerprint") || "")) {
      return NextResponse.json({ error: "Le fichier a changé depuis l’analyse. Relance l’analyse avant de confirmer." }, { status: 409 });
    }
    const decisions = parseDecisions(formData.get("decisions"));
    const table = parseClientSpreadsheet(fileBuffer);

    const { data: contactsData, error: contactsError } = await supabase.from("seller_contacts").select(CONTACT_COLUMNS).eq("user_id", user.id);
    if (contactsError) throw contactsError;
    const plan = buildClientImportPlan(table, (contactsData || []).map((contact) => normalizeExistingClient(contact)));

    const { data: importRecord, error: importError } = await supabase.from("client_imports").insert({
      user_id: user.id,
      original_filename: file.name,
      file_hash: fingerprint,
      file_type: file.name.split(".").pop()?.toLowerCase() || "unknown",
      row_count: plan.summary.rowsDetected,
      column_mapping: plan.mappings,
      recommended_automations: plan.recommendedAutomations,
      status: "processing",
    }).select("id").single();
    if (importError || !importRecord) throw importError || new Error("Impossible de créer le journal d’import.");
    importId = importRecord.id;

    const automaticTags = new Set<string>(CLIENT_IMPORT_TAGS);
    const enabledTags = new Set(decisions.enabledTags.filter((tag) => automaticTags.has(tag)));
    const clean = (data: ClientImportData) => ({ ...data, roles: [...data.roles], tags: data.tags.filter((tag) => !automaticTags.has(tag) || enabledTags.has(tag)) });
    const creates: Array<{ data: ClientImportData; rows: ImportRow[]; outcome: "created" | "merged" }> = [];
    const updates: Array<{ id: string; data: ClientImportData; rows: ImportRow[]; changed: boolean; warnings: string[] }> = [];
    const audit: Audit[] = [];
    let mergedDuplicates = 0;

    for (const group of plan.groups) {
      applyCertainGroup(group, decisions.certainAction, clean, creates, updates, audit, (count) => { mergedDuplicates += count; });
    }
    for (const ambiguous of plan.ambiguous) {
      if (decisions.ambiguousAction === "keep") {
        creates.push({ data: clean(ambiguous.data), rows: [ambiguous], outcome: "created" });
      } else if (decisions.ambiguousAction === "merge" && ambiguous.matches.length === 1) {
        const existing = (contactsData || []).find((contact) => String(contact.id) === ambiguous.matches[0].id);
        if (existing) {
          const result = mergeClientData(normalizeExistingClient(existing), clean(ambiguous.data));
          updates.push({ id: String(existing.id), data: result.data, rows: [ambiguous], changed: result.changedFields.length > 0, warnings: result.conflicts });
          mergedDuplicates += 1;
        }
      } else {
        audit.push({ contact_id: null, row_numbers: [ambiguous.rowNumber], outcome: decisions.ambiguousAction === "review" || decisions.ambiguousAction === "merge" ? "needs_review" : "skipped", warnings: [...ambiguous.warnings, "Correspondance de nom ambiguë"] });
      }
    }
    plan.unimportable.forEach((row) => audit.push({ contact_id: null, row_numbers: [row.rowNumber], outcome: "incomplete", warnings: [...row.warnings, "Aucune identité exploitable"] }));

    const appliedUpdates = consolidateUpdates(updates);
    for (const batch of chunks(appliedUpdates, 200)) {
      const rows = batch.map((item) => ({ id: item.id, ...contactDatabaseRow(item.data, user.id, importId) }));
      const { error } = await supabase.from("seller_contacts").upsert(rows, { onConflict: "id" });
      if (error) throw error;
      batch.forEach((item) => {
        audit.push({ contact_id: item.id, row_numbers: item.rows.map((row) => row.rowNumber), outcome: item.changed ? (item.rows.length > 1 ? "merged" : "updated") : "unchanged", warnings: item.warnings });
      });
    }

    let createdCount = 0;
    for (const batch of chunks(creates, 150)) {
      const { data, error } = await supabase.from("seller_contacts").insert(batch.map((item) => contactDatabaseRow(item.data, user.id, importId))).select("id");
      if (error || !data || data.length !== batch.length) throw error || new Error("Une partie des fiches clients n’a pas pu être créée.");
      data.forEach((created, index) => {
        const item = batch[index];
        audit.push({ contact_id: created.id, row_numbers: item.rows.map((row) => row.rowNumber), outcome: item.outcome, warnings: [] });
        createdCount += 1;
      });
    }

    for (const batch of chunks(audit, 300)) {
      const { error } = await supabase.from("client_import_contacts").insert(batch.map((item) => ({ ...item, user_id: user.id, import_id: importId })));
      if (error) throw error;
    }

    const report = {
      rowsAnalyzed: plan.summary.rowsDetected,
      created: createdCount,
      updated: appliedUpdates.filter((item) => item.changed).length,
      unchanged: appliedUpdates.filter((item) => !item.changed).length,
      mergedDuplicates,
      needsReview: audit.filter((item) => item.outcome === "needs_review").reduce((sum, item) => sum + item.row_numbers.length, 0),
      skipped: audit.filter((item) => item.outcome === "skipped").reduce((sum, item) => sum + item.row_numbers.length, 0),
      incomplete: plan.summary.incompleteLines,
      mortgageRenewalMissing: [...creates.map((item) => item.data), ...appliedUpdates.map((item) => item.data)].filter((item) => !item.mortgageRenewalDate).length,
      automaticMessagesSent: 0,
    };
    const { error: completionError } = await supabase.from("client_imports").update({ summary: report, status: "completed", completed_at: new Date().toISOString() }).eq("id", importId).eq("user_id", user.id);
    if (completionError) throw completionError;

    return NextResponse.json({
      importId,
      report,
      recommendedAutomations: plan.recommendedAutomations,
      coachMessage: coachReport(report),
    });
  } catch (error) {
    console.error("[client-import/confirm]", error);
    if (importId) {
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.from("client_imports").update({ status: "failed", summary: { error: error instanceof Error ? error.message : "Erreur inconnue" } }).eq("id", importId);
      } catch { /* Le journal initial reste en traitement si Supabase est indisponible. */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "L’import n’a pas pu être terminé." }, { status: 500 });
  }
}

function applyCertainGroup(
  group: ClientImportGroup,
  action: DuplicateAction,
  clean: (data: ClientImportData) => ClientImportData,
  creates: Array<{ data: ClientImportData; rows: ImportRow[]; outcome: "created" | "merged" }>,
  updates: Array<{ id: string; data: ClientImportData; rows: ImportRow[]; changed: boolean; warnings: string[] }>,
  audit: Audit[],
  addMerged: (count: number) => void,
) {
  if (group.kind === "existing") {
    if (action === "ignore") {
      audit.push({ contact_id: group.existingId || null, row_numbers: group.rows.map((row) => row.rowNumber), outcome: "skipped", warnings: group.warnings });
    } else if (action === "keep") {
      group.rows.forEach((row) => creates.push({ data: clean(row.data), rows: [row], outcome: "created" }));
    } else {
      const result = mergeClientData(group.baseData!, clean(group.incomingData));
      updates.push({ id: group.existingId!, data: result.data, rows: group.rows, changed: result.changedFields.length > 0, warnings: [...group.warnings, ...result.conflicts] });
      addMerged(group.rows.length);
    }
    return;
  }
  if (action === "keep" && group.rows.length > 1) {
    group.rows.forEach((row) => creates.push({ data: clean(row.data), rows: [row], outcome: "created" }));
  } else if (action === "ignore" && group.rows.length > 1) {
    creates.push({ data: clean(group.rows[0].data), rows: [group.rows[0]], outcome: "created" });
    audit.push({ contact_id: null, row_numbers: group.rows.slice(1).map((row) => row.rowNumber), outcome: "skipped", warnings: group.warnings });
  } else {
    creates.push({ data: clean(group.incomingData), rows: group.rows, outcome: group.rows.length > 1 ? "merged" : "created" });
    addMerged(Math.max(0, group.rows.length - 1));
  }
}

function parseDecisions(value: FormDataEntryValue | null): Decisions {
  let parsed: Partial<Decisions> = {};
  try { parsed = JSON.parse(String(value || "{}")); } catch { throw new Error("Les décisions d’import sont invalides."); }
  const certainAction = ["merge", "keep", "ignore"].includes(String(parsed.certainAction)) ? parsed.certainAction as DuplicateAction : "merge";
  const ambiguousAction = ["review", "merge", "keep", "ignore"].includes(String(parsed.ambiguousAction)) ? parsed.ambiguousAction as AmbiguousAction : "review";
  return { certainAction, ambiguousAction, enabledTags: Array.isArray(parsed.enabledTags) ? parsed.enabledTags.map(String) : [...CLIENT_IMPORT_TAGS] };
}

function chunks<T>(values: T[], size: number) { const output: T[][] = []; for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size)); return output; }
function consolidateUpdates(updates: Array<{ id: string; data: ClientImportData; rows: ImportRow[]; changed: boolean; warnings: string[] }>) {
  const consolidated = new Map<string, typeof updates[number]>();
  for (const update of updates) {
    const current = consolidated.get(update.id);
    if (!current) { consolidated.set(update.id, update); continue; }
    const merged = mergeClientData(current.data, update.data);
    consolidated.set(update.id, {
      id: update.id,
      data: merged.data,
      rows: [...current.rows, ...update.rows],
      changed: current.changed || update.changed || merged.changedFields.length > 0,
      warnings: [...new Set([...current.warnings, ...update.warnings, ...merged.conflicts])],
    });
  }
  return [...consolidated.values()];
}
function coachReport(report: { rowsAnalyzed: number; created: number; updated: number; mergedDuplicates: number; needsReview: number; mortgageRenewalMissing: number }) {
  return `J’ai analysé ${report.rowsAnalyzed.toLocaleString("fr-CA")} contacts.\n\n${(report.created + report.updated).toLocaleString("fr-CA")} fiches uniques ont été créées ou mises à jour.\n${report.mergedDuplicates.toLocaleString("fr-CA")} doublons ont été fusionnés.\n${report.needsReview.toLocaleString("fr-CA")} contacts nécessitent une vérification.\n\nIl manque la date de renouvellement hypothécaire pour ${report.mortgageRenewalMissing.toLocaleString("fr-CA")} clients.\n\nJe te recommande de préparer une campagne de mise à jour. Aucun message n’a été envoyé.`;
}
