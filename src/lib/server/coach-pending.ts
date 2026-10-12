import type { CoachIntent } from "@/lib/coach/conversation";
import { foldCoach } from "@/lib/coach/conversation";
import { dateWindow, localDay } from "@/lib/connections/dates";

export class CoachClarification extends Error {
  constructor(public kind: "time" | "title" | "calendar_connection", message: string) { super(message); this.name = "CoachClarification"; }
}
export type PendingCoachAction = {
  intent: CoachIntent; text: string; kind: string;
  options: { id: string; label: string }[];
  selections?: Record<string, string>; timeZone?: string;
  mode?: "clarification"; createdAt?: string;
};
export function isCoachCancellation(text: string) {
  return /^(annule|annuler|laisse tomber|oublie|non merci|cancel)(\s+(ca|cela|le rappel|le rendez vous|cette action))?[.! ]*$/.test(foldCoach(text));
}
// Freeze relative dates before asking for a missing field, so "tomorrow" does
// not move when the user refreshes or answers after midnight.
export function freezeCoachDate(intent: CoachIntent, timeZone = "America/Toronto", now = new Date()) {
  if (!intent.dateExpression || !["create_calendar_event", "update_calendar_event"].includes(intent.tool)) return intent;
  const window = dateWindow(intent.dateExpression, now, false, undefined, timeZone);
  const day = localDay(new Date(window.start), timeZone);
  const time = intent.dateExpression.match(/\b([01]?\d|2[0-3])\s*(?:h(?:eures?)?|:)\s*([0-5]\d)?\b/i);
  const clock = time ? `${time[1]} h ${time[2] || "00"}` : /\bmidi\b/i.test(intent.dateExpression) && !/apr[eè]s[- ]midi/i.test(intent.dateExpression) ? "12 h" : /minuit/i.test(intent.dateExpression) ? "0 h" : "";
  return { ...intent, dateExpression: `${day}${clock ? ` à ${clock}` : ""}` };
}
export function resumeCoachPending(pending: PendingCoachAction, text: string): CoachIntent | null {
  const folded = foldCoach(text);
  if (pending.mode !== "clarification") return null;
  const titleCorrection = text.match(/^(?:titre|change le titre|renomme)(?:\s*[:=]\s*|\s+en\s+)(.+)$/i);
  if (titleCorrection) return { ...pending.intent, title: titleCorrection[1].trim().slice(0, 240) };
  if (pending.kind === "calendar_connection" && /^(connecte|c est connecte|reessaie|reprends|continue)$/.test(folded)) return pending.intent;
  if (pending.kind === "title" && !/^(trouve|montre|cherche|annule)/.test(folded)) return { ...pending.intent, title: text.trim().slice(0, 240) };
  // Only date/time answers resume the action. A different request goes through
  // the ordinary router and clears this pending action.
  const correction = text.replace(/^(?:non[, ]*)?(?:plut[oô]t\s+|finalement\s+|à\s+)?/i, "").trim();
  if (/^\d{1,2}\s*(?:h|:)/i.test(correction) && !/^(?:[01]?\d|2[0-3])\s*(?:h(?:eures?)?|:)\s*(?:[0-5]\d)?[.! ]*$/i.test(correction)) throw new CoachClarification("time", "Cette heure est invalide. Quelle heure entre 0 h et 23 h 59 veux-tu utiliser ?");
  if (!/^(?:(?:demain|aujourd['’]hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{4}-\d{2}-\d{2})(?:\s+prochain)?(?:\s+(?:à|a))?\s*)?(?:(?:[01]?\d|2[0-3])\s*(?:h(?:eures?)?|:)\s*(?:[0-5]\d)?|midi|minuit)?[.! ]*$/i.test(correction) || !correction) return null;
  const day = pending.intent.dateExpression?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const includesDay = /demain|aujourd|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{4}-\d{2}-\d{2}/i.test(correction);
  const oldClock = pending.intent.dateExpression?.match(/à (.+)$/)?.[1];
  const includesClock = /\d\s*(h|:)|midi|minuit/i.test(correction);
  return freezeCoachDate({ ...pending.intent, dateExpression: includesDay ? `${correction}${!includesClock && oldClock ? ` à ${oldClock}` : ""}` : `${day || "aujourd’hui"} à ${correction}` }, pending.timeZone);
}
