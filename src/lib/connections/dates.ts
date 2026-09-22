const zone = "America/Toronto";
export function localDay(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function torontoInstant(day: string, hour: number, minute = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error("Date ou heure invalide.");
  const wall = `${day}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00`, target = Date.parse(`${wall}Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0,10) !== day) throw new Error("Date invalide.");
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const matches = [4,5].map(offset => new Date(target + offset * 3600000)).filter(date => formatter.format(date).replace(" ","T") === wall);
  if (matches.length !== 1) throw new Error("Cette heure est ambiguë ou inexistante lors du changement d’heure. Choisis une autre heure.");
  return matches[0].toISOString();
}
export function dateWindow(expression: string, now = new Date(), requireTime = false, previous?: { start: string; end: string } | null) {
  const text = expression.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2})?/g,"$1 à $2 h $3").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), today = localDay(now);
  let day = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const weekday = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"].findIndex(d => text.includes(d));
  const explicitDay = Boolean(day || weekday >= 0 || /demain|aujourd|ce matin|cet apres|ce soir/.test(text));
  const numericDay = Boolean(day);
  if (!day) { const date = new Date(`${today}T12:00:00Z`); if (/apres[- ]demain/.test(text)) date.setUTCDate(date.getUTCDate()+2); else if (text.includes("demain")) date.setUTCDate(date.getUTCDate()+1); else if (weekday >= 0) date.setUTCDate(date.getUTCDate()+((weekday-date.getUTCDay()+7)%7 || (text.includes("prochain") ? 7 : 0))); day = date.toISOString().slice(0,10); }
  const time = text.match(/\b([01]?\d|2[0-3])\s*(?:h(?:eures?)?|:)\s*([0-5]\d)?\b/);
  const noon = /\bmidi\b/.test(text) && !/apres[- ]midi/.test(text), midnight = /\bminuit\b/.test(text);
  if (requireTime && !time && !noon && !midnight) { if (previous && !explicitDay && Date.parse(previous.end)-Date.parse(previous.start) <= 8*3600000) return previous; throw new Error("À quelle heure précisément ?"); }
  if (!explicitDay && previous) day = localDay(new Date(previous.start));
  const hour = time ? Number(time[1]) : noon ? 12 : midnight ? 0 : /apres[- ]midi/.test(text) ? 12 : /matin/.test(text) ? 6 : /soir/.test(text) ? 18 : 0;
  const start = torontoInstant(day,hour,time?.[2] ? Number(time[2]) : 0);
  let end: string;
  if (time || noon || midnight) end = new Date(Date.parse(start)+3600000).toISOString();
  else if (/matin/.test(text)) end = torontoInstant(day,12);
  else if (/apres[- ]midi/.test(text)) end = torontoInstant(day,18);
  else { const next = new Date(`${day}T12:00:00Z`); next.setUTCDate(next.getUTCDate()+(/semaine/.test(text) ? 7 : 1)); end = torontoInstant(next.toISOString().slice(0,10),0); }
  if (!numericDay && weekday >= 0 && Date.parse(end) <= now.getTime()) {
    const next = new Date(`${day}T12:00:00Z`); next.setUTCDate(next.getUTCDate()+7);
    return dateWindow(expression.replace(new RegExp(["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][weekday],"i"),next.toISOString().slice(0,10)),now,requireTime,previous);
  }
  return { start,end };
}
export function displayDate(iso: string) { return new Intl.DateTimeFormat("fr-CA", { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); }
