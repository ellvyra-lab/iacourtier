export const CLIENT_IMPORT_TAGS = [
  "Acheteur", "Vendeur", "Ancien acheteur", "Ancien vendeur", "Prospect", "Investisseur",
  "Client actif", "Ancien client", "Renouvellement hypothécaire connu",
  "Renouvellement hypothécaire manquant", "Anniversaire connu", "Anniversaire manquant", "À qualifier",
] as const;

export type ClientImportField =
  | "firstName" | "lastName" | "fullName" | "phone" | "email" | "mailingAddress" | "city" | "postalCode"
  | "birthDate" | "purchaseDate" | "saleDate" | "mortgageRenewalDate" | "clientType"
  | "buyer" | "seller" | "formerClient" | "prospect" | "investor" | "source" | "notes" | "tags";

export type ColumnMapping = { index: number; source: string; field: ClientImportField; label: string; confidence: number };

export type ClientImportData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mailingAddress: string;
  city: string;
  postalCode: string;
  birthDate: string;
  purchaseDate: string;
  saleDate: string;
  mortgageRenewalDate: string;
  clientStatus: string;
  source: string;
  notes: string;
  roles: string[];
  tags: string[];
};

export type ImportRow = { rowNumber: number; data: ClientImportData; missing: string[]; warnings: string[] };

export type ExistingClient = ClientImportData & { id: string };

export type ClientImportGroup = {
  key: string;
  kind: "new" | "existing";
  existingId?: string;
  baseData?: ClientImportData;
  incomingData: ClientImportData;
  rows: ImportRow[];
  warnings: string[];
};

export type AmbiguousImportRow = ImportRow & {
  matches: Array<{ id: string; name: string; email: string; phone: string }>;
};

export type ClientImportSummary = {
  rowsDetected: number;
  uniqueClientsProjected: number;
  newClients: number;
  existingClients: number;
  certainDuplicates: number;
  ambiguousDuplicates: number;
  incompleteLines: number;
  unimportableLines: number;
};

export type AutomationRecommendation = {
  key: string;
  label: string;
  eligible: number;
  reason: string;
  enabled: false;
};

export type ClientImportPlan = {
  summary: ClientImportSummary;
  mappings: ColumnMapping[];
  unrecognizedColumns: string[];
  groups: ClientImportGroup[];
  ambiguous: AmbiguousImportRow[];
  unimportable: ImportRow[];
  tagCounts: Record<string, number>;
  recommendedAutomations: AutomationRecommendation[];
};

type RawTable = { headers: string[]; rows: unknown[][] };

const FIELD_LABELS: Record<ClientImportField, string> = {
  firstName: "Prénom", lastName: "Nom", fullName: "Nom complet", phone: "Téléphone", email: "Courriel",
  mailingAddress: "Adresse", city: "Ville", postalCode: "Code postal", birthDate: "Date de naissance",
  purchaseDate: "Date d’achat", saleDate: "Date de vente", mortgageRenewalDate: "Renouvellement hypothécaire",
  clientType: "Type de client", buyer: "Acheteur", seller: "Vendeur", formerClient: "Ancien client",
  prospect: "Prospect", investor: "Investisseur", source: "Source", notes: "Notes", tags: "Tags",
};

const ALIASES: Record<ClientImportField, string[]> = {
  firstName: ["prenom", "first name", "firstname", "given name", "givenname"],
  lastName: ["nom", "nom de famille", "lastname", "last name", "family name", "surname"],
  fullName: ["nom complet", "nom du client", "client", "contact", "fullname", "full name", "name", "display name"],
  phone: ["tel", "telephone", "telephone principal", "cell", "cellulaire", "mobile", "phone", "phone number", "phone 1 value", "mobile phone"],
  email: ["courriel", "courriel principal", "email", "e mail", "email address", "e mail 1 value", "email 1 value"],
  mailingAddress: ["adresse", "adresse postale", "rue", "street", "address", "mailing address", "address 1 street"],
  city: ["ville", "city", "municipalite", "municipality", "address 1 city"],
  postalCode: ["code postal", "codepostal", "postal code", "postalcode", "zip", "zip code", "address 1 postal code"],
  birthDate: ["date de naissance", "naissance", "anniversaire", "birthday", "birth date", "birthdate", "date of birth", "dob"],
  purchaseDate: ["date achat", "date d achat", "date acquisition", "date d acquisition", "purchase date", "closing date purchase", "acquisition date"],
  saleDate: ["date vente", "date de vente", "sale date", "sold date", "closing date sale"],
  mortgageRenewalDate: ["renouvellement hypothecaire", "date renouvellement hypothecaire", "mortgage renewal", "mortgage renewal date", "renewal date"],
  clientType: ["type de client", "type client", "client type", "contact type", "categorie", "category", "statut client"],
  buyer: ["acheteur", "buyer", "is buyer"], seller: ["vendeur", "seller", "is seller"],
  formerClient: ["ancien client", "former client", "past client", "client passe"],
  prospect: ["prospect", "lead", "is prospect"], investor: ["investisseur", "investor", "is investor"],
  source: ["source", "provenance", "lead source", "contact source"],
  notes: ["note", "notes", "commentaire", "commentaires", "comments", "description"],
  tags: ["tag", "tags", "etiquette", "etiquettes", "labels", "group membership"],
};

const TEXT_FIELDS: Array<keyof Omit<ClientImportData, "roles" | "tags">> = [
  "firstName", "lastName", "email", "phone", "mailingAddress", "city", "postalCode", "birthDate",
  "purchaseDate", "saleDate", "mortgageRenewalDate", "clientStatus", "source", "notes",
];

export function detectClientColumns(headers: string[]) {
  const mappings: ColumnMapping[] = [];
  headers.forEach((source, index) => {
    const normalized = normalizeHeader(source);
    if (!normalized) return;
    let selected: ClientImportField | null = null;
    let confidence = 0;
    for (const [field, aliases] of Object.entries(ALIASES) as Array<[ClientImportField, string[]]>) {
      const exact = aliases.some((alias) => normalizeHeader(alias) === normalized);
      const googleVariant = aliases.some((alias) => normalized.startsWith(`${normalizeHeader(alias)} `) || normalized.endsWith(` ${normalizeHeader(alias)}`));
      if (exact || (googleVariant && confidence < 0.9)) {
        selected = field;
        confidence = exact ? 1 : 0.9;
        if (exact) break;
      }
    }
    if (selected) mappings.push({ index, source, field: selected, label: FIELD_LABELS[selected], confidence });
  });
  return { mappings, unrecognizedColumns: headers.filter((_, index) => !mappings.some((mapping) => mapping.index === index)) };
}

export function normalizeClientRows(table: RawTable, mappings: ColumnMapping[]) {
  return table.rows.map((values, index) => normalizeRow(values, index + 2, mappings)).filter((row) => row.data.firstName || row.data.lastName || row.data.email || row.data.phone || row.data.mailingAddress || row.data.notes);
}

export function normalizeExistingClient(value: Record<string, unknown>): ExistingClient {
  const roles = arrayStrings(value.roles);
  const data: ClientImportData = {
    firstName: cleanText(value.first_name), lastName: cleanText(value.last_name),
    email: normalizeEmail(value.email).value, phone: normalizePhone(value.phone).value,
    mailingAddress: cleanText(value.mailing_address), city: cleanText(value.city), postalCode: normalizePostalCode(value.postal_code),
    birthDate: normalizeDate(value.birth_date).value, purchaseDate: normalizeDate(value.purchase_date).value,
    saleDate: normalizeDate(value.sale_date).value, mortgageRenewalDate: normalizeDate(value.mortgage_renewal_date).value,
    clientStatus: cleanText(value.client_status) || "prospect", source: cleanText(value.source), notes: cleanText(value.notes),
    roles, tags: unique(arrayStrings(value.tags)),
  };
  return { id: String(value.id), ...data };
}

export function buildClientImportPlan(table: RawTable, existing: ExistingClient[]): ClientImportPlan {
  const { mappings, unrecognizedColumns } = detectClientColumns(table.headers);
  const rows = normalizeClientRows(table, mappings);
  const groups: ClientImportGroup[] = existing.map((client) => ({
    key: `existing:${client.id}`, kind: "existing", existingId: client.id, baseData: client,
    incomingData: emptyClient(), rows: [], warnings: [],
  }));
  const ambiguous: AmbiguousImportRow[] = [];
  const unimportable: ImportRow[] = [];
  let certainDuplicates = 0;
  let incompleteLines = 0;
  let nextNewGroup = 1;
  const indexes = createGroupIndexes();
  groups.forEach((group) => indexGroup(indexes, group, group.baseData!));

  for (const row of rows) {
    if (row.missing.length) incompleteLines += 1;
    if (!hasUsableIdentity(row.data)) { unimportable.push(row); continue; }
    const certain = indexedCertainGroups(indexes, row.data);
    if (certain.length === 1) {
      const group = certain[0];
      group.incomingData = mergeIncoming(group.incomingData, row.data, group.warnings);
      group.rows.push(row);
      indexGroup(indexes, group, group.incomingData);
      certainDuplicates += 1;
      continue;
    }
    if (certain.length > 1) {
      ambiguous.push({ ...row, matches: certain.filter((group) => group.existingId && group.baseData).map((group) => matchSummary(group.existingId!, group.baseData!)) });
      continue;
    }
    const nameMatches = indexedNameGroups(indexes, row.data);
    if (nameMatches.length) {
      ambiguous.push({ ...row, matches: nameMatches.filter((group) => group.existingId && group.baseData).map((group) => matchSummary(group.existingId!, group.baseData!)) });
      continue;
    }
    const group: ClientImportGroup = { key: `new:${nextNewGroup++}`, kind: "new", incomingData: row.data, rows: [row], warnings: [...row.warnings] };
    groups.push(group);
    indexGroup(indexes, group, row.data);
  }

  const touchedGroups = groups.filter((group) => group.rows.length);
  const newGroups = touchedGroups.filter((group) => group.kind === "new");
  const existingGroups = touchedGroups.filter((group) => group.kind === "existing");
  const effectiveClients = touchedGroups.map((group) => group.kind === "existing" ? mergeClientData(group.baseData!, group.incomingData).data : group.incomingData);
  const automationPopulation = [...effectiveClients, ...ambiguous.map((row) => row.data)];

  return {
    summary: {
      rowsDetected: rows.length,
      uniqueClientsProjected: newGroups.length + existingGroups.length,
      newClients: newGroups.length,
      existingClients: existingGroups.length,
      certainDuplicates,
      ambiguousDuplicates: ambiguous.length,
      incompleteLines,
      unimportableLines: unimportable.length,
    },
    mappings,
    unrecognizedColumns,
    groups: touchedGroups,
    ambiguous,
    unimportable,
    tagCounts: countTags([...effectiveClients, ...ambiguous.map((row) => row.data)]),
    recommendedAutomations: automationRecommendations(automationPopulation),
  };
}

export function mergeClientData(existing: ClientImportData, incoming: ClientImportData) {
  const data = { ...existing, roles: [...existing.roles], tags: [...existing.tags] };
  const changedFields: string[] = [];
  const conflicts: string[] = [];
  for (const field of TEXT_FIELDS) {
    const current = existing[field];
    const next = incoming[field];
    if (!next) continue;
    if (!current || (field === "clientStatus" && current === "prospect" && next !== "prospect")) {
      data[field] = next;
      changedFields.push(field);
    } else if (comparable(current) !== comparable(next)) {
      conflicts.push(FIELD_LABELS[field === "clientStatus" ? "clientType" : field as ClientImportField] || field);
    }
  }
  const roles = unique([...existing.roles, ...incoming.roles]);
  const tags = unique([...existing.tags, ...incoming.tags]);
  if (roles.length !== existing.roles.length) changedFields.push("roles");
  if (tags.length !== existing.tags.length) changedFields.push("tags");
  data.roles = roles;
  data.tags = tags;
  return { data, changedFields: unique(changedFields), conflicts: unique(conflicts) };
}

export function contactDatabaseRow(data: ClientImportData, userId: string, importId: string) {
  return {
    user_id: userId,
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email || null,
    phone: data.phone || null,
    mailing_address: data.mailingAddress || null,
    city: data.city || null,
    postal_code: data.postalCode || null,
    birth_date: data.birthDate || null,
    purchase_date: data.purchaseDate || null,
    sale_date: data.saleDate || null,
    mortgage_renewal_date: data.mortgageRenewalDate || null,
    client_status: data.clientStatus || "prospect",
    source: data.source || null,
    notes: data.notes || null,
    roles: data.roles,
    tags: data.tags,
    last_import_id: importId,
    updated_at: new Date().toISOString(),
  };
}

export function publicImportPreview(plan: ClientImportPlan) {
  return {
    summary: plan.summary,
    mappings: plan.mappings,
    unrecognizedColumns: plan.unrecognizedColumns,
    tagCounts: plan.tagCounts,
    recommendedAutomations: plan.recommendedAutomations,
    ambiguousExamples: plan.ambiguous.slice(0, 20).map((row) => ({ rowNumber: row.rowNumber, name: clientName(row.data), email: row.data.email, phone: row.data.phone, matches: row.matches })),
    incompleteExamples: [...plan.groups.flatMap((group) => group.rows.filter((row) => row.missing.length)), ...plan.ambiguous.filter((row) => row.missing.length), ...plan.unimportable].slice(0, 20).map((row) => ({ rowNumber: row.rowNumber, name: clientName(row.data), missing: row.missing, warnings: row.warnings })),
  };
}

function normalizeRow(values: unknown[], rowNumber: number, mappings: ColumnMapping[]): ImportRow {
  const read = (field: ClientImportField) => mappings.filter((mapping) => mapping.field === field).map((mapping) => values[mapping.index]).find((value) => cleanText(value)) ?? "";
  const warnings: string[] = [];
  let firstName = cleanText(read("firstName"));
  let lastName = cleanText(read("lastName"));
  if (!firstName && !lastName) ({ firstName, lastName } = splitFullName(cleanText(read("fullName"))));
  const email = normalizeEmail(read("email"));
  const phone = normalizePhone(read("phone"));
  if (email.warning) warnings.push(email.warning);
  if (phone.warning) warnings.push(phone.warning);
  const dates = {
    birthDate: normalizeDate(read("birthDate")), purchaseDate: normalizeDate(read("purchaseDate")),
    saleDate: normalizeDate(read("saleDate")), mortgageRenewalDate: normalizeDate(read("mortgageRenewalDate")),
  };
  Object.values(dates).forEach((date) => { if (date.warning) warnings.push(date.warning); });

  const roleTags = rolesAndTags({
    clientType: cleanText(read("clientType")), buyer: truthy(read("buyer")), seller: truthy(read("seller")),
    formerClient: truthy(read("formerClient")), prospect: truthy(read("prospect")), investor: truthy(read("investor")),
    purchaseDate: dates.purchaseDate.value, saleDate: dates.saleDate.value,
  });
  const providedTags = splitTags(read("tags"));
  const data: ClientImportData = {
    firstName, lastName, email: email.value, phone: phone.value,
    mailingAddress: cleanText(read("mailingAddress")), city: cleanText(read("city")), postalCode: normalizePostalCode(read("postalCode")),
    birthDate: dates.birthDate.value, purchaseDate: dates.purchaseDate.value, saleDate: dates.saleDate.value,
    mortgageRenewalDate: dates.mortgageRenewalDate.value, clientStatus: roleTags.clientStatus,
    source: cleanText(read("source")), notes: cleanText(read("notes")), roles: roleTags.roles,
    tags: unique([...providedTags, ...roleTags.tags]),
  };
  data.tags = unique([...data.tags, data.birthDate ? "Anniversaire connu" : "Anniversaire manquant", data.mortgageRenewalDate ? "Renouvellement hypothécaire connu" : "Renouvellement hypothécaire manquant"]);
  const missing: string[] = [];
  if (!firstName && !lastName) missing.push("nom");
  if (!email) missing.push("courriel");
  if (!phone.value) missing.push("téléphone");
  if (!data.birthDate) missing.push("date de naissance");
  if (!data.mortgageRenewalDate) missing.push("renouvellement hypothécaire");
  if (!data.roles.length) { data.roles = ["prospect"]; data.tags.push("Prospect", "À qualifier"); }
  if (!firstName || !lastName || (!email.value && !phone.value)) data.tags.push("À qualifier");
  data.tags = unique(data.tags);
  return { rowNumber, data, missing: unique(missing), warnings: unique(warnings) };
}

function rolesAndTags(input: { clientType: string; buyer: boolean; seller: boolean; formerClient: boolean; prospect: boolean; investor: boolean; purchaseDate: string; saleDate: string }) {
  const normalized = normalizeHeader(input.clientType);
  const buyer = input.buyer || /acheteur|buyer/.test(normalized);
  const seller = input.seller || /vendeur|seller/.test(normalized);
  const investor = input.investor || /investisseur|investor/.test(normalized);
  const former = input.formerClient || /ancien|former|past/.test(normalized) || Boolean(input.purchaseDate || input.saleDate);
  const prospect = input.prospect || /prospect|lead/.test(normalized) || (!buyer && !seller && !investor && !former);
  const roles = unique([buyer ? "buyer" : "", seller ? "seller" : "", investor ? "investor" : "", prospect ? "prospect" : ""].filter(Boolean));
  const tags = unique([
    buyer ? "Acheteur" : "", seller ? "Vendeur" : "", investor ? "Investisseur" : "", prospect ? "Prospect" : "",
    former ? "Ancien client" : "", input.purchaseDate ? "Ancien acheteur" : "", input.saleDate ? "Ancien vendeur" : "",
    !former && (buyer || seller) ? "Client actif" : "",
  ].filter(Boolean));
  return { roles, tags, clientStatus: former ? "former_client" : prospect ? "prospect" : "active" };
}

type GroupIndexes = {
  email: Map<string, Set<ClientImportGroup>>;
  phone: Map<string, Set<ClientImportGroup>>;
  nameAddress: Map<string, Set<ClientImportGroup>>;
  name: Map<string, Set<ClientImportGroup>>;
};

function createGroupIndexes(): GroupIndexes { return { email: new Map(), phone: new Map(), nameAddress: new Map(), name: new Map() }; }
function addGroupIndex(index: Map<string, Set<ClientImportGroup>>, key: string, group: ClientImportGroup) {
  if (!key) return;
  const values = index.get(key) || new Set<ClientImportGroup>();
  values.add(group);
  index.set(key, values);
}
function indexGroup(indexes: GroupIndexes, group: ClientImportGroup, data: ClientImportData) {
  const name = nameKey(data);
  const address = comparable(data.mailingAddress);
  addGroupIndex(indexes.email, comparable(data.email), group);
  addGroupIndex(indexes.phone, phoneKey(data.phone), group);
  addGroupIndex(indexes.name, name, group);
  if (name && address) addGroupIndex(indexes.nameAddress, `${name}|${address}`, group);
}
function indexedCertainGroups(indexes: GroupIndexes, data: ClientImportData) {
  const matches = new Set<ClientImportGroup>();
  const collect = (values?: Set<ClientImportGroup>) => values?.forEach((group) => matches.add(group));
  collect(indexes.email.get(comparable(data.email)));
  collect(indexes.phone.get(phoneKey(data.phone)));
  const name = nameKey(data);
  const address = comparable(data.mailingAddress);
  if (name && address) collect(indexes.nameAddress.get(`${name}|${address}`));
  return [...matches];
}
function indexedNameGroups(indexes: GroupIndexes, data: ClientImportData) {
  const name = nameKey(data);
  return name ? [...(indexes.name.get(name) || [])] : [];
}

function mergeIncoming(current: ClientImportData, next: ClientImportData, warnings: string[]) {
  const merged = { ...current, roles: [...current.roles], tags: [...current.tags] };
  for (const field of TEXT_FIELDS) {
    if (!merged[field] && next[field]) merged[field] = next[field];
    else if (merged[field] && next[field] && comparable(merged[field]) !== comparable(next[field])) warnings.push(`Conflit entre lignes : ${field}`);
  }
  merged.roles = unique([...current.roles, ...next.roles]);
  merged.tags = unique([...current.tags, ...next.tags]);
  return merged;
}

function automationRecommendations(clients: ClientImportData[]): AutomationRecommendation[] {
  const emailClients = clients.filter((client) => client.email);
  const former = clients.filter((client) => client.clientStatus === "former_client");
  const sellerOrBuyer = clients.filter((client) => client.roles.some((role) => role === "seller" || role === "buyer"));
  const recommendation = (key: string, label: string, eligible: number, reason: string): AutomationRecommendation => ({ key, label, eligible, reason, enabled: false });
  return [
    recommendation("birthdays", "Anniversaires", clients.filter((client) => client.birthDate && client.email).length, "Date de naissance et courriel connus"),
    recommendation("purchase_anniversaries", "Anniversaires d’achat", clients.filter((client) => client.purchaseDate && client.email).length, "Date d’achat et courriel connus"),
    recommendation("sale_anniversaries", "Anniversaires de vente", clients.filter((client) => client.saleDate && client.email).length, "Date de vente et courriel connus"),
    recommendation("mortgage_renewals", "Renouvellements hypothécaires", clients.filter((client) => client.mortgageRenewalDate && client.email).length, "Date de renouvellement et courriel connus"),
    recommendation("review_requests", "Demandes d’avis", clients.filter((client) => (client.purchaseDate || client.saleDate) && client.email).length, "Transaction antérieure documentée"),
    recommendation("quarterly_followup", "Suivis trimestriels", emailClients.length, "Courriel disponible"),
    recommendation("market_report", "Rapports de marché", sellerOrBuyer.filter((client) => client.email).length, "Intérêt acheteur ou vendeur identifié"),
    recommendation("reactivation", "Réactivation des anciens clients", former.filter((client) => client.email).length, "Ancien client avec courriel"),
    recommendation("referrals", "Demandes de références", former.filter((client) => client.email).length, "Relation client antérieure"),
    recommendation("seasonal", "Campagnes saisonnières", emailClients.length, "Courriel disponible"),
  ];
}

function emptyClient(): ClientImportData { return { firstName: "", lastName: "", email: "", phone: "", mailingAddress: "", city: "", postalCode: "", birthDate: "", purchaseDate: "", saleDate: "", mortgageRenewalDate: "", clientStatus: "prospect", source: "", notes: "", roles: [], tags: [] }; }
function hasUsableIdentity(data: ClientImportData) { return Boolean(data.email || data.phone || nameKey(data)); }
function matchSummary(id: string, data: ClientImportData) { return { id, name: clientName(data), email: data.email, phone: data.phone }; }
function clientName(data: ClientImportData) { return `${data.firstName} ${data.lastName}`.trim() || data.email || data.phone || "Client à identifier"; }
function nameKey(data: ClientImportData) { return comparable(`${data.firstName}${data.lastName}`); }
function phoneKey(value: string) { return value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""); }
function comparable(value: unknown) { return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function normalizeHeader(value: unknown) { return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_\-–—]+/g, " ").replace(/[^a-z0-9]+/g, " ").trim(); }
function cleanText(value: unknown) { return value instanceof Date ? value.toISOString() : value === null || value === undefined ? "" : String(value).replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim(); }
function arrayStrings(value: unknown) { return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : []; }
function unique<T>(values: T[]) { return [...new Set(values)]; }
function truthy(value: unknown) { return /^(1|true|vrai|yes|oui|x|y)$/i.test(cleanText(value)); }
function splitTags(value: unknown) { return unique(cleanText(value).split(/[;,|]/).map((item) => item.trim()).filter(Boolean)); }
function normalizePostalCode(value: unknown) { const compact = cleanText(value).toUpperCase().replace(/\s/g, ""); return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact) ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact; }

function splitFullName(value: string) {
  if (!value) return { firstName: "", lastName: "" };
  if (value.includes(",")) {
    const [lastName, ...rest] = value.split(",");
    return { firstName: rest.join(" ").trim(), lastName: lastName.trim() };
  }
  const parts = value.split(/\s+/).filter(Boolean);
  return parts.length === 1 ? { firstName: parts[0], lastName: "" } : { firstName: parts.shift() || "", lastName: parts.join(" ") };
}

function normalizeEmail(value: unknown) {
  const email = cleanText(value).toLowerCase().replace(/^mailto:/, "");
  if (!email) return { value: "", warning: "" };
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { value: email, warning: "" } : { value: "", warning: `Courriel invalide ignoré : ${email}` };
}

function normalizePhone(value: unknown) {
  const original = cleanText(value);
  if (!original) return { value: "", warning: "" };
  let digits = original.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length === 10) return { value: `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`, warning: "" };
  if (digits.length >= 7 && digits.length <= 15) return { value: `+${digits}`, warning: "" };
  return { value: "", warning: `Téléphone invalide ignoré : ${original}` };
}

function normalizeDate(value: unknown) {
  if (value === null || value === undefined || value === "") return { value: "", warning: "" };
  let date: Date | null = null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) date = value;
  else if (typeof value === "number" && value > 0 && value < 100000) date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
  else {
    const text = cleanText(value);
    const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    const local = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (iso) date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    else if (local) {
      const year = Number(local[3]) < 100 ? 2000 + Number(local[3]) : Number(local[3]);
      date = new Date(Date.UTC(year, Number(local[2]) - 1, Number(local[1])));
    } else {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
  }
  if (!date || Number.isNaN(date.getTime())) return { value: "", warning: `Date invalide ignorée : ${cleanText(value)}` };
  return { value: date.toISOString().slice(0, 10), warning: "" };
}

function countTags(clients: ClientImportData[]) {
  const counts: Record<string, number> = {};
  clients.forEach((client) => client.tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }));
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1]));
}
