import * as XLSX from "xlsx";

const MAX_ROWS = 25_000;
const MAX_COLUMNS = 120;

export function parseClientSpreadsheet(data: Buffer) {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "buffer", cellDates: true, dense: true, sheetRows: MAX_ROWS + 2 });
  } catch (error) {
    throw new Error(`Le fichier n’a pas pu être lu comme CSV, XLSX ou XLS : ${error instanceof Error ? error.message : "format invalide"}`);
  }
  const sheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name];
    return sheet && XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "", range: 0 }).length > 0;
  });
  if (!sheetName) throw new Error("Le fichier ne contient aucune feuille avec des données.");
  const values = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, blankrows: false, defval: "", raw: true });
  if (values.length < 2) throw new Error("La liste doit contenir une ligne d’en-têtes et au moins une ligne client.");
  const headers = values[0].slice(0, MAX_COLUMNS).map((value) => String(value ?? "").trim());
  const rows = values.slice(1, MAX_ROWS + 1).map((row) => row.slice(0, MAX_COLUMNS));
  if (values.length > MAX_ROWS + 1) throw new Error(`La liste dépasse la limite sécuritaire de ${MAX_ROWS.toLocaleString("fr-CA")} contacts par import.`);
  if (!headers.some(Boolean)) throw new Error("Aucun en-tête de colonne n’a été détecté.");
  return { sheetName, headers, rows };
}
