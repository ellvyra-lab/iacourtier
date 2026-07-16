import { officialBuyerWorkflow, officialSellerWorkflow } from "@/lib/business-rules";
import { getSoniaProspects, saveSoniaProspects } from "@/lib/sonia-beta/storage";
import type { ClientImportProfile, ClientRelationshipType, SoniaProspect } from "@/lib/sonia-beta/types";

export type ImportField =
  | "firstName" | "lastName" | "fullName" | "email" | "phone" | "address" | "city" | "postalCode"
  | "relationshipType" | "transactionDate" | "birthDate" | "mortgageRenewalDate" | "lender"
  | "mortgageBroker" | "lastContact" | "notes" | "communicationConsent";

export type ColumnMapping = Record<string, ImportField | "ignore">;
export type DuplicateDecision = "merge" | "keep-both" | "ignore";

export type ParsedClientRow = {
  rowNumber: number;
  values: Record<string, string>;
  relationshipType: ClientRelationshipType;
};

export type DuplicateMatch = {
  rowNumber: number;
  existingId: string;
  existingName: string;
  reasons: string[];
};

export type ImportPreview = {
  headers: string[];
  mapping: ColumnMapping;
  uncertainHeaders: string[];
  rows: ParsedClientRow[];
};

type SpreadsheetWorkbook = {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
};

type SpreadsheetLibrary = {
  read: (data: ArrayBuffer, options: { type: "array"; cellDates: boolean }) => SpreadsheetWorkbook;
  utils: {
    sheet_to_json: (sheet: unknown, options: { header: 1; raw: false; defval: string }) => unknown[][];
  };
};

declare global {
  interface Window {
    XLSX?: SpreadsheetLibrary;
  }
}

const SHEETJS_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

export type ImportReport = {
  imported: number;
  duplicates: number;
  ignored: number;
  errors: string[];
  readyForAutomation: number;
  contactsToComplete: number;
};

export const IMPORT_FIELD_LABELS: Record<ImportField | "ignore", string> = {
  ignore: "Ne pas importer",
  firstName: "Prénom",
  lastName: "Nom",
  fullName: "Nom complet",
  email: "Courriel",
  phone: "Téléphone",
  address: "Adresse",
  city: "Ville",
  postalCode: "Code postal",
  relationshipType: "Type de client",
  transactionDate: "Date de transaction",
  birthDate: "Date de naissance",
  mortgageRenewalDate: "Renouvellement hypothécaire",
  lender: "Prêteur ou institution",
  mortgageBroker: "Courtier hypothécaire",
  lastContact: "Dernier contact",
  notes: "Notes",
  communicationConsent: "Consentement communication",
};

export const RELATIONSHIP_LABELS: Record<ClientRelationshipType, string> = {
  buyer: "Acheteur",
  seller: "Vendeur",
  both: "Acheteur et vendeur",
  investor: "Investisseur",
  former: "Ancien client",
  prospect: "Prospect",
  partner: "Partenaire",
  other: "Autre",
};

const FIELD_ALIASES: Record<ImportField, string[]> = {
  firstName: ["prenom", "prénom", "first name", "firstname", "given name"],
  lastName: ["nom", "last name", "lastname", "surname", "family name"],
  fullName: ["nom complet", "client", "contact", "full name", "fullname", "contact name"],
  email: ["courriel", "courriel principal", "email", "e-mail", "email address", "mail"],
  phone: ["telephone", "téléphone", "tel", "phone", "mobile", "cell", "cellulaire", "phone number"],
  address: ["adresse", "address", "street", "street address"],
  city: ["ville", "city", "municipalite", "municipalité"],
  postalCode: ["code postal", "postal code", "postcode", "zip", "zip code"],
  relationshipType: ["type de client", "type client", "client type", "contact type", "acheteur", "vendeur", "investisseur"],
  transactionDate: ["date de transaction", "transaction date", "closing date", "date achat", "date vente"],
  birthDate: ["date de naissance", "naissance", "birth date", "birthdate", "birthday", "dob"],
  mortgageRenewalDate: ["date de renouvellement hypothecaire", "date renouvellement hypothécaire", "renouvellement hypothecaire", "mortgage renewal date", "mortgage renewal"],
  lender: ["preteur", "prêteur", "institution", "institution financiere", "institution financière", "lender", "bank", "banque"],
  mortgageBroker: ["courtier hypothecaire", "courtier hypothécaire", "mortgage broker"],
  lastContact: ["dernier contact", "date dernier contact", "last contact", "last contacted"],
  notes: ["notes", "note", "commentaires", "comments", "description"],
  communicationConsent: ["consentement communication", "consentement", "communication consent", "marketing consent", "opt in", "opt-in"],
};

export async function parseClientFile(file: File): Promise<ImportPreview> {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "csv") return parseClientCsv(await file.text());
  if (extension !== "xlsx" && extension !== "xls") throw new Error("Choisissez un fichier CSV, XLSX ou XLS.");

  const spreadsheet = await loadSpreadsheetLibrary();
  const workbook = spreadsheet.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheets = workbook.SheetNames.map((name) => ({
    name,
    matrix: spreadsheet.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "" })
      .map((row) => row.map((value) => String(value ?? "").trim())),
  })).filter((sheet) => sheet.matrix.some((row) => row.some(Boolean)));

  if (!sheets.length) throw new Error("Le classeur ne contient aucune feuille exploitable.");
  const bestSheet = sheets.sort((a, b) => sheetScore(b.matrix) - sheetScore(a.matrix))[0];
  return previewFromMatrix(bestSheet.matrix);
}

export function parseClientCsv(text: string): ImportPreview {
  return previewFromMatrix(parseCsv(text.replace(/^\uFEFF/, "")));
}

function previewFromMatrix(matrix: string[][]): ImportPreview {
  const headerIndex = findHeaderRow(matrix);
  if (headerIndex < 0 || matrix.length <= headerIndex + 1) throw new Error("Le fichier ne contient aucune ligne de contact.");

  const headers = matrix[headerIndex].map((header, index) => header.trim() || `Colonne ${index + 1}`);
  const mapping = detectColumnMapping(headers);
  const uncertainHeaders = headers.filter((header) => {
    const match = bestFieldMatch(header);
    return mapping[header] === "ignore" || match.score < 80;
  });
  const rows = matrix.slice(headerIndex + 1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row, index) => {
      const values = Object.fromEntries(headers.map((header, column) => [header, row[column]?.trim() || ""]));
      return {
        rowNumber: headerIndex + index + 2,
        values,
        relationshipType: inferRelationshipType(valueFor(values, mapping, "relationshipType")),
      };
    });

  return { headers, mapping, uncertainHeaders, rows };
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const used = new Set<ImportField>();
  return Object.fromEntries(headers.map((header) => {
    const match = bestFieldMatch(header);
    if (!match.field || match.score < 45 || used.has(match.field)) return [header, "ignore"];
    used.add(match.field);
    return [header, match.field];
  }));
}

function bestFieldMatch(header: string): { field?: ImportField; score: number } {
  const normalizedHeader = normalize(header);
  const headerTokens = new Set(normalizedHeader.split(" ").filter(Boolean));
  let best: { field?: ImportField; score: number } = { score: 0 };

  (Object.entries(FIELD_ALIASES) as Array<[ImportField, string[]]>).forEach(([field, aliases]) => {
    aliases.forEach((alias) => {
      const normalizedAlias = normalize(alias);
      const aliasTokens = normalizedAlias.split(" ").filter(Boolean);
      const shared = aliasTokens.filter((token) => headerTokens.has(token)).length;
      const score = normalizedHeader === normalizedAlias
        ? 100
        : normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)
          ? 82
          : aliasTokens.length ? Math.round((shared / Math.max(aliasTokens.length, headerTokens.size)) * 70) : 0;
      if (score > best.score) best = { field, score };
    });
  });

  return best;
}

export function getImportStatistics(rows: ParsedClientRow[], mapping: ColumnMapping) {
  const duplicates = findDuplicates(rows, mapping, getSoniaProspects());
  return {
    contacts: rows.length,
    duplicates: duplicates.length,
    missingEmails: rows.filter((row) => !valueFor(row.values, mapping, "email")).length,
    missingPhones: rows.filter((row) => !valueFor(row.values, mapping, "phone")).length,
    missingMortgageRenewals: rows.filter((row) => !valueFor(row.values, mapping, "mortgageRenewalDate")).length,
    missingBirthDates: rows.filter((row) => !valueFor(row.values, mapping, "birthDate")).length,
  };
}

export function findDuplicates(rows: ParsedClientRow[], mapping: ColumnMapping, existing: SoniaProspect[]): DuplicateMatch[] {
  const seen: Array<{ rowNumber: number; name: string; email: string; phone: string; address: string }> = [];
  const matches: DuplicateMatch[] = [];

  for (const row of rows) {
    const email = normalizeEmail(valueFor(row.values, mapping, "email"));
    const phone = normalizePhone(valueFor(row.values, mapping, "phone"));
    const name = normalize(buildName(row.values, mapping));
    const address = normalize(valueFor(row.values, mapping, "address"));
    const existingMatch = existing.find((contact) =>
      (email && normalizeEmail(contact.email || "") === email) ||
      (phone && normalizePhone(contact.phone || "") === phone) ||
      (name && address && normalize(contact.name) === name && normalize(contact.address) === address)
    );
    const rowMatch = seen.find((contact) =>
      (email && contact.email === email) ||
      (phone && contact.phone === phone) ||
      (name && address && contact.name === name && contact.address === address)
    );
    const match = existingMatch || rowMatch;
    if (match) {
      const matchEmail = "email" in match ? normalizeEmail(match.email || "") : "";
      const matchPhone = "phone" in match ? normalizePhone(match.phone || "") : "";
      const matchName = normalize(match.name);
      const matchAddress = normalize(match.address || "");
      const reasons = [
        email && matchEmail === email ? "courriel" : "",
        phone && matchPhone === phone ? "téléphone" : "",
        name && address && matchName === name && matchAddress === address ? "nom + adresse" : "",
      ].filter(Boolean);
      matches.push({
        rowNumber: row.rowNumber,
        existingId: existingMatch ? existingMatch.id : `row:${rowMatch?.rowNumber}`,
        existingName: match.name,
        reasons,
      });
    }
    seen.push({ rowNumber: row.rowNumber, name, email, phone, address });
  }

  return matches;
}

export function importClientRows(
  rows: ParsedClientRow[],
  mapping: ColumnMapping,
  decisions: Record<number, DuplicateDecision>,
): ImportReport {
  let contacts = getSoniaProspects();
  const duplicates = findDuplicates(rows, mapping, contacts);
  const duplicateByRow = new Map(duplicates.map((duplicate) => [duplicate.rowNumber, duplicate]));
  const report: ImportReport = { imported: 0, duplicates: duplicates.length, ignored: 0, errors: [], readyForAutomation: 0, contactsToComplete: 0 };

  for (const row of rows) {
    try {
      const duplicate = duplicateByRow.get(row.rowNumber);
      const decision = duplicate ? decisions[row.rowNumber] : undefined;
      if (duplicate && !decision) {
        report.errors.push(`Ligne ${row.rowNumber} : choisissez quoi faire avec le doublon.`);
        continue;
      }
      if (decision === "ignore") {
        report.ignored += 1;
        continue;
      }

      const incoming = buildProspect(row, mapping);
      if (!incoming.name || incoming.name === "Contact importé") {
        report.ignored += 1;
        report.errors.push(`Ligne ${row.rowNumber} : nom manquant.`);
        continue;
      }

      if (duplicate && decision === "merge") {
        const targetId = duplicate.existingId.startsWith("row:")
          ? contacts.find((contact) => contact.id.includes(`-${duplicate.existingId.slice(4)}-`) && contact.id.startsWith("import-"))?.id
          : duplicate.existingId;
        if (!targetId) {
          report.errors.push(`Ligne ${row.rowNumber} : le contact à fusionner est introuvable.`);
          continue;
        }
        contacts = contacts.map((contact) => contact.id === targetId ? mergeWithoutOverwrite(contact, incoming) : contact);
      } else {
        contacts = [incoming, ...contacts];
      }

      report.imported += 1;
      if (incoming.importProfile?.automationEligible.length) report.readyForAutomation += 1;
      if (incoming.importProfile?.missingInformation.length) report.contactsToComplete += 1;
    } catch (error) {
      report.errors.push(`Ligne ${row.rowNumber} : ${error instanceof Error ? error.message : "erreur inconnue"}`);
    }
  }

  saveSoniaProspects(contacts);
  return report;
}

function buildProspect(row: ParsedClientRow, mapping: ColumnMapping): SoniaProspect {
  const now = new Date().toISOString();
  const relationshipType = row.relationshipType;
  const pipelineType = relationshipType === "seller" ? "seller" : relationshipType === "both" ? "seller" : "buyer";
  const email = valueFor(row.values, mapping, "email");
  const phone = valueFor(row.values, mapping, "phone");
  const mortgageRenewalDate = valueFor(row.values, mapping, "mortgageRenewalDate");
  const birthDate = valueFor(row.values, mapping, "birthDate");
  const lastContact = valueFor(row.values, mapping, "lastContact");
  const consent = parseConsent(valueFor(row.values, mapping, "communicationConsent"));
  const missingInformation = [
    !email ? "Courriel" : "",
    !phone ? "Téléphone" : "",
    !mortgageRenewalDate ? "Renouvellement hypothécaire" : "",
    !birthDate ? "Date de naissance" : "",
  ].filter(Boolean);
  const automationEligible = [
    consent && email ? "Communications relationnelles" : "",
    mortgageRenewalDate ? "Suivi hypothécaire" : "",
    valueFor(row.values, mapping, "transactionDate") ? "Suivi post-transaction" : "",
  ].filter(Boolean);

  const importProfile: ClientImportProfile = {
    firstName: valueFor(row.values, mapping, "firstName") || undefined,
    lastName: valueFor(row.values, mapping, "lastName") || undefined,
    postalCode: valueFor(row.values, mapping, "postalCode") || undefined,
    relationshipType,
    transactionDate: valueFor(row.values, mapping, "transactionDate") || undefined,
    birthDate: birthDate || undefined,
    mortgageRenewalDate: mortgageRenewalDate || undefined,
    lender: valueFor(row.values, mapping, "lender") || undefined,
    mortgageBroker: valueFor(row.values, mapping, "mortgageBroker") || undefined,
    lastContact: lastContact || undefined,
    communicationConsent: consent,
    automationEligible,
    missingInformation,
  };

  return {
    id: `import-${Date.now()}-${row.rowNumber}-${Math.random().toString(36).slice(2, 7)}`,
    name: buildName(row.values, mapping) || "Contact importé",
    email: email || undefined,
    phone: phone || undefined,
    address: valueFor(row.values, mapping, "address"),
    city: valueFor(row.values, mapping, "city"),
    clientType: pipelineType,
    source: "Pipeline",
    status: pipelineType === "seller" ? officialSellerWorkflow[0] : officialBuyerWorkflow[0],
    notes: valueFor(row.values, mapping, "notes"),
    nextAction: missingInformation.length ? "Compléter la fiche client" : "Planifier le prochain suivi relationnel",
    nextActionDate: new Date().toISOString().slice(0, 10),
    createdAt: now,
    updatedAt: now,
    importProfile,
    history: [{
      id: `history-import-${Date.now()}-${row.rowNumber}`,
      date: now,
      title: "Client importé",
      description: `Import CSV. Type : ${RELATIONSHIP_LABELS[relationshipType]}. Aucune communication envoyée.`,
      type: "status",
    }],
  };
}

function mergeWithoutOverwrite(existing: SoniaProspect, incoming: SoniaProspect): SoniaProspect {
  const existingProfile = existing.importProfile;
  const incomingProfile = incoming.importProfile;
  return {
    ...existing,
    email: existing.email || incoming.email,
    phone: existing.phone || incoming.phone,
    address: existing.address || incoming.address,
    city: existing.city || incoming.city,
    notes: [existing.notes, incoming.notes].filter(Boolean).join("\n\n"),
    updatedAt: new Date().toISOString(),
    importProfile: incomingProfile ? {
      ...incomingProfile,
      ...existingProfile,
      automationEligible: Array.from(new Set([...(existingProfile?.automationEligible || []), ...incomingProfile.automationEligible])),
      missingInformation: incomingProfile.missingInformation.filter((field) => {
        if (field === "Courriel") return !(existing.email || incoming.email);
        if (field === "Téléphone") return !(existing.phone || incoming.phone);
        return true;
      }),
    } : existingProfile,
    history: [{
      id: `history-merge-${Date.now()}`,
      date: new Date().toISOString(),
      title: "Données d'import fusionnées",
      description: "Seuls les champs vides ont été complétés; aucune donnée existante n'a été écrasée.",
      type: "status",
    }, ...existing.history],
  };
}

function buildName(values: Record<string, string>, mapping: ColumnMapping) {
  const fullName = valueFor(values, mapping, "fullName");
  return fullName || [valueFor(values, mapping, "firstName"), valueFor(values, mapping, "lastName")].filter(Boolean).join(" ");
}

function valueFor(values: Record<string, string>, mapping: ColumnMapping, field: ImportField) {
  const header = Object.keys(mapping).find((key) => mapping[key] === field);
  return header ? values[header]?.trim() || "" : "";
}

function inferRelationshipType(value: string): ClientRelationshipType {
  const normalized = normalize(value);
  if (/acheteur.*vendeur|buyer.*seller|vendeur.*acheteur/.test(normalized)) return "both";
  if (/invest/.test(normalized)) return "investor";
  if (/ancien|former|past client/.test(normalized)) return "former";
  if (/partenaire|partner/.test(normalized)) return "partner";
  if (/vendeur|seller/.test(normalized)) return "seller";
  if (/acheteur|buyer/.test(normalized)) return "buyer";
  if (/prospect|lead/.test(normalized)) return "prospect";
  return "other";
}

function parseConsent(value: string) {
  return /^(oui|yes|true|1|consenti|accepté|accepte|opt.?in)$/i.test(value.trim());
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function findHeaderRow(matrix: string[][]) {
  let bestIndex = -1;
  let bestScore = 0;
  matrix.slice(0, 20).forEach((row, index) => {
    const recognized = row.filter((cell) => bestFieldMatch(cell).score >= 45).length;
    const populated = row.filter((cell) => cell.trim()).length;
    const score = recognized * 10 + populated;
    if (recognized > 0 && score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestIndex;
}

function sheetScore(matrix: string[][]) {
  const headerIndex = findHeaderRow(matrix);
  if (headerIndex < 0) return 0;
  return matrix.slice(headerIndex + 1).filter((row) => row.some((cell) => cell.trim())).length * 100 + matrix[headerIndex].filter(Boolean).length;
}

async function loadSpreadsheetLibrary(): Promise<SpreadsheetLibrary> {
  if (typeof window === "undefined") throw new Error("La lecture Excel doit être effectuée dans le navigateur.");
  if (window.XLSX) return window.XLSX;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SHEETJS_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Le lecteur Excel n’a pas pu être chargé.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SHEETJS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Le lecteur Excel n’a pas pu être chargé. Vérifiez votre connexion et réessayez."));
    document.head.appendChild(script);
  });

  if (!window.XLSX) throw new Error("Le format Excel n’est pas disponible pour le moment.");
  return window.XLSX;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if ((character === "," || character === ";" || character === "\t") && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}
