export const CALL_OUTCOMES = [
  { value: "no_answer", label: "Pas de réponse" },
  { value: "voicemail", label: "Message vocal laissé" },
  { value: "answered", label: "A répondu" },
  { value: "appointment", label: "Rendez-vous obtenu" },
  { value: "follow_up", label: "À rappeler" },
  { value: "not_interested", label: "Pas intéressé" },
  { value: "invalid_number", label: "Mauvais numéro" },
  { value: "do_not_contact", label: "Ne plus contacter" },
  { value: "other", label: "Autre" },
] as const;

export type CallOutcome = typeof CALL_OUTCOMES[number]["value"];

export function normalizePhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function formatPhone(value?: string | null) {
  const normalized = normalizePhone(value);
  if (!normalized) return String(value || "").trim();
  const digits = normalized.slice(2);
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function telHref(value?: string | null) {
  const normalized = normalizePhone(value);
  return normalized ? `tel:${normalized}` : null;
}

export const phoneHref = telHref;

export function outcomeLabel(value?: string | null) {
  return CALL_OUTCOMES.find((item) => item.value === value)?.label || "Appel";
}

