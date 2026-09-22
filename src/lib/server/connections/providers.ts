import "server-only";
import type { Attachment, CalendarEvent, CalendarProvider, ConnectedAccount, Email, EmailProvider, EmailQuery, EventInput, OutgoingEmail } from "@/lib/connections/types";
import { accountToken, connectionAudit, connectionStore } from "./accounts";
import { torontoInstant } from "@/lib/connections/dates";

type Json = Record<string, any>; // Provider wire formats are normalized before leaving this module.
type RequestApi = (path: string, init?: RequestInit) => Promise<Json>;
const eid = encodeURIComponent;
const textOnly = (value: string) => value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
export function mailbox(value: string) { const found = value.match(/<([^<>]+)>/); const address = (found?.[1] || value).trim(); if (!/^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/.test(address)) throw new Error("L’adresse courriel doit être vérifiée avant envoi."); return address; }
const limit = (n?: number) => Math.max(1, Math.min(30, n || 20));
function googleParts(part: Json): Json[] { return [part, ...(part.parts || []).flatMap(googleParts)]; }
function googleEmail(m: Json): Email {
  const h = (name: string) => String((m.payload?.headers || []).find((v: Json) => v.name.toLowerCase() === name.toLowerCase())?.value || "");
  const parts = googleParts(m.payload || {}), plain = parts.filter(p => p.mimeType === "text/plain" && p.body?.data);
  const body = (plain.length ? plain : parts.filter(p => p.mimeType === "text/html" && p.body?.data)).map(p => Buffer.from(p.body.data, "base64url").toString("utf8")).join("\n");
  return { id: m.id, threadId: m.threadId, subject: h("Subject"), from: h("From"), replyTo: h("Reply-To") || h("From"), to: h("To").split(","), text: (plain.length ? body : textOnly(body)).slice(0, 16000), receivedAt: new Date(Number(m.internalDate)).toISOString(), unread: (m.labelIds || []).includes("UNREAD"), sent: (m.labelIds || []).includes("SENT"), automated: Boolean(h("List-Unsubscribe") || h("List-Id") || (h("Auto-Submitted") && h("Auto-Submitted") !== "no")) || /no.?reply|newsletter/i.test(h("From")), internetMessageId: h("Message-ID"), references: h("References"), url: `https://mail.google.com/mail/u/0/#all/${eid(m.threadId)}` };
}
function microsoftEmail(m: Json): Email {
  const address = (a: Json) => a?.emailAddress?.address || "";
  const headers = m.internetMessageHeaders || [];
  return { id: m.id, threadId: m.conversationId, subject: m.subject || "", from: address(m.from), replyTo: address(m.replyTo?.[0]) || address(m.from), to: (m.toRecipients || []).map(address), text: (m.body?.contentType?.toLowerCase() === "html" ? textOnly(m.body.content) : m.body?.content || m.bodyPreview || "").slice(0, 16000), receivedAt: m.receivedDateTime || m.sentDateTime, unread: !m.isRead, sent: false, automated: /no.?reply|newsletter/i.test(address(m.from)) || headers.some((h: Json) => /^(list-unsubscribe|list-id)$/i.test(h.name) || /^auto-submitted$/i.test(h.name) && h.value !== "no"), internetMessageId: m.internetMessageId, url: m.webLink };
}
export function googleMime(input: OutgoingEmail) {
  const clean = (s: string) => s.replace(/[\r\n]/g, "");
  const headers = [`To: ${mailbox(input.to)}`, `Subject: =?UTF-8?B?${Buffer.from(clean(input.subject)).toString("base64")}?=`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", `Message-ID: <${input.operationId}@iacourtier.ca>`];
  if (input.replyTo?.internetMessageId) headers.push(`In-Reply-To: ${clean(input.replyTo.internetMessageId)}`, `References: ${clean(`${input.replyTo.references || ""} ${input.replyTo.internetMessageId}`).trim()}`);
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${Buffer.from(input.text).toString("base64").match(/.{1,76}/g)?.join("\r\n") || ""}`).toString("base64url");
}
export class GoogleEmailProvider implements EmailProvider {
  constructor(private api: RequestApi) {}
  async listMessages(input: EmailQuery) { return this.searchMessages(input); }
  async searchMessages(input: EmailQuery) {
    const query = [input.query ? `"${input.query.replace(/["\\]/g, " ").slice(0, 200)}"` : "", input.since ? `after:${Math.floor(new Date(input.since).getTime() / 1000)}` : "newer_than:30d", input.unread ? "is:unread" : "", "-in:spam -in:trash -in:drafts"].filter(Boolean).join(" ");
    const data = await this.api(`/gmail/v1/users/me/messages?${new URLSearchParams({ q: query, maxResults: String(limit(input.limit)) })}`);
    return Promise.all((data.messages || []).map((m: Json) => this.getMessage(m.id)));
  }
  async getMessage(id: string) { return googleEmail(await this.api(`/gmail/v1/users/me/messages/${eid(id)}?format=full`)); }
  async getThread(id: string) { const data = await this.api(`/gmail/v1/users/me/threads/${eid(id)}?format=full`); return (data.messages || []).filter((m: Json) => !(m.labelIds || []).includes("DRAFT")).slice(-30).map(googleEmail).sort((a: Email,b: Email) => a.receivedAt.localeCompare(b.receivedAt)); }
  async createDraft(input: OutgoingEmail) { const result = await this.api("/gmail/v1/users/me/drafts", { method: "POST", body: JSON.stringify({ message: { raw: googleMime(input), ...(input.replyTo ? { threadId: input.replyTo.threadId } : {}) } }) }); return String(result.id); }
  async replyToMessage(input: OutgoingEmail) { if (!input.replyTo) throw new Error("Courriel d’origine requis."); return this.createDraft(input); }
  async sendMessage(draftId: string) { const data = await this.api("/gmail/v1/users/me/drafts/send", { method: "POST", body: JSON.stringify({ id: draftId }) }); if (!data.id) throw new Error("L’envoi n’a pas été confirmé par Google."); return { id: String(data.id), threadId: String(data.threadId), accepted: false }; }
  async getAttachments(id: string): Promise<Attachment[]> { const data = await this.api(`/gmail/v1/users/me/messages/${eid(id)}?format=full`); return googleParts(data.payload || {}).filter(p => p.filename).map(p => ({ id: p.body?.attachmentId || p.partId, name: p.filename, size: p.body?.size || 0, contentType: p.mimeType })); }
}
const msSelect = "id,conversationId,subject,from,replyTo,toRecipients,body,receivedDateTime,sentDateTime,isRead,isDraft,internetMessageId,internetMessageHeaders,webLink";
export class MicrosoftEmailProvider implements EmailProvider {
  constructor(private api: RequestApi, private ownAddress: string) {}
  private normalize(m: Json) { const result = microsoftEmail(m); result.sent = result.from.toLowerCase() === this.ownAddress.toLowerCase(); return result; }
  async listMessages(q: EmailQuery) { return this.searchMessages(q); }
  async searchMessages(input: EmailQuery) {
    const since = new Date(input.since || Date.now() - 30 * 86400000).toISOString();
    const params = new URLSearchParams({ "$top": String(limit(input.limit)), "$select": msSelect });
    if (input.query) params.set("$search", `"${input.query.replace(/["\\]/g, " ").slice(0, 200)} received>=${since.slice(0,10)}"`);
    else { params.set("$filter", `receivedDateTime ge ${since} and isDraft eq false${input.unread ? " and isRead eq false" : ""}`); params.set("$orderby", "receivedDateTime desc"); }
    const data = await this.api(`/v1.0/me/messages?${params}`);
    return (data.value || []).filter((m: Json) => !m.isDraft && (!input.unread || !m.isRead) && m.receivedDateTime >= since).map((m: Json) => this.normalize(m));
  }
  async getMessage(id: string) { return this.normalize(await this.api(`/v1.0/me/messages/${eid(id)}?$select=${msSelect}`)); }
  async getThread(id: string) {
    const params = new URLSearchParams({ "$filter": `conversationId eq '${id.replace(/'/g, "''")}' and isDraft eq false`, "$select": msSelect, "$top": "100" });
    const data = await this.api(`/v1.0/me/messages?${params}`);
    if (data["@odata.nextLink"]) throw new Error("Cette conversation dépasse 100 messages. Ouvre-la dans Outlook pour vérifier sa dernière réponse.");
    return (data.value || []).map((m: Json) => this.normalize(m)).sort((a: Email,b: Email) => a.receivedAt.localeCompare(b.receivedAt));
  }
  async createDraft(input: OutgoingEmail) {
    if (input.replyTo) return this.replyToMessage(input);
    const data = await this.api("/v1.0/me/messages", { method: "POST", body: JSON.stringify({ subject: input.subject, body: { contentType: "Text", content: input.text }, toRecipients: [{ emailAddress: { address: mailbox(input.to) } }], internetMessageHeaders: [{ name: "x-iacourtier-operation", value: input.operationId }] }) }); return String(data.id);
  }
  async replyToMessage(input: OutgoingEmail) {
    if (!input.replyTo) throw new Error("Courriel d’origine requis.");
    const draft = await this.api(`/v1.0/me/messages/${eid(input.replyTo.id)}/createReply`, { method: "POST", body: "{}" });
    await this.api(`/v1.0/me/messages/${eid(draft.id)}`, { method: "PATCH", body: JSON.stringify({ subject: input.subject, toRecipients: [{ emailAddress: { address: mailbox(input.to) } }], body: { contentType: "Text", content: input.text } }) });
    return String(draft.id);
  }
  async sendMessage(id: string) { await this.api(`/v1.0/me/messages/${eid(id)}/send`, { method: "POST" }); return { id, accepted: true }; }
  async getAttachments(id: string): Promise<Attachment[]> { const data = await this.api(`/v1.0/me/messages/${eid(id)}/attachments?$select=id,name,size,contentType&$top=50`); return (data.value || []).map((a: Json) => ({ id: a.id, name: a.name, size: a.size, contentType: a.contentType })); }
}
function googleEvent(e: Json): CalendarEvent { return { id: e.id, title: e.summary || "Occupé", start: e.start?.dateTime || torontoInstant(e.start?.date,0), end: e.end?.dateTime || torontoInstant(e.end?.date,0), location: e.location || "", busy: e.transparency !== "transparent" && e.status !== "cancelled" && !(e.attendees || []).some((a: Json) => a.self && a.responseStatus === "declined"), url: e.htmlLink, version: e.etag }; }
function msEvent(e: Json): CalendarEvent { const utc = (v: Json) => `${v?.dateTime || ""}${v?.timeZone === "UTC" && !/Z$|[+-]\d\d:\d\d$/.test(v.dateTime) ? "Z" : ""}`; return { id: e.id, title: e.subject || "Occupé", start: utc(e.start), end: utc(e.end), location: e.location?.displayName || "", busy: !e.isCancelled && e.showAs !== "free" && e.responseStatus?.response !== "declined", url: e.webLink, version: e["@odata.etag"] }; }
export class GoogleCalendarProvider implements CalendarProvider {
  constructor(private api: RequestApi) {}
  async listEvents(start: string, end: string) { const data = await this.api(`/calendar/v3/calendars/primary/events?${new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: "true", orderBy: "startTime", maxResults: "250", timeZone: "America/Toronto" })}`); if (data.nextPageToken) throw new Error("Trop de rendez-vous dans cette période. Précise une plage plus courte."); return (data.items || []).filter((e: Json) => e.status !== "cancelled").map(googleEvent); }
  async searchEvents(query: string, start: string, end: string) { return (await this.listEvents(start,end)).filter((e: CalendarEvent) => `${e.title} ${e.location}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))); }
  async getEvent(id: string) { return googleEvent(await this.api(`/calendar/v3/calendars/primary/events/${eid(id)}`)); }
  async checkAvailability(start: string,end: string,excludeId?: string) { return (await this.listEvents(start,end)).filter((e: CalendarEvent) => e.busy && e.id !== excludeId); }
  private body(input: EventInput) { return { summary: input.title, location: input.location, start: { dateTime: input.start, timeZone: "America/Toronto" }, end: { dateTime: input.end, timeZone: "America/Toronto" } }; }
  async createEvent(input: EventInput) { return googleEvent(await this.api("/calendar/v3/calendars/primary/events", { method: "POST", body: JSON.stringify({ ...this.body(input), id: input.operationId.replace(/-/g, "") }) })); }
  async updateEvent(id: string,input: EventInput,version?: string) { return googleEvent(await this.api(`/calendar/v3/calendars/primary/events/${eid(id)}`, { method: "PATCH", headers: version ? { "If-Match": version } : {}, body: JSON.stringify(this.body(input)) })); }
  async deleteEvent(id: string,version?: string) { await this.api(`/calendar/v3/calendars/primary/events/${eid(id)}`, { method: "DELETE", headers: version ? { "If-Match": version } : {} }); }
}
export class MicrosoftCalendarProvider implements CalendarProvider {
  constructor(private api: RequestApi) {}
  async listEvents(start: string,end: string) { const data = await this.api(`/v1.0/me/calendarView?${new URLSearchParams({ startDateTime: start, endDateTime: end, "$top": "250", "$orderby": "start/dateTime" })}`); if (data["@odata.nextLink"]) throw new Error("Trop de rendez-vous dans cette période. Précise une plage plus courte."); return (data.value || []).map(msEvent); }
  async searchEvents(query: string,start: string,end: string) { return (await this.listEvents(start,end)).filter((e: CalendarEvent) => `${e.title} ${e.location}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))); }
  async getEvent(id: string) { return msEvent(await this.api(`/v1.0/me/events/${eid(id)}`)); }
  async checkAvailability(start: string,end: string,excludeId?: string) { return (await this.listEvents(start,end)).filter((e: CalendarEvent) => e.busy && e.id !== excludeId); }
  private body(i: EventInput) { return { subject: i.title, location: { displayName: i.location }, start: { dateTime: new Date(i.start).toISOString().replace(/Z$/, ""), timeZone: "UTC" }, end: { dateTime: new Date(i.end).toISOString().replace(/Z$/, ""), timeZone: "UTC" } }; }
  async createEvent(i: EventInput) { return msEvent(await this.api("/v1.0/me/events", { method: "POST", body: JSON.stringify({ ...this.body(i), transactionId: i.operationId }) })); }
  async updateEvent(id: string,i: EventInput,version?: string) { return msEvent(await this.api(`/v1.0/me/events/${eid(id)}`, { method: "PATCH", headers: version ? { "If-Match": version } : {}, body: JSON.stringify(this.body(i)) })); }
  async deleteEvent(id: string,version?: string) { await this.api(`/v1.0/me/events/${eid(id)}`, { method: "DELETE", headers: version ? { "If-Match": version } : {} }); }
}
export async function connectedProviders(userId: string, accountId: string, sourceMessageId?: string): Promise<{ account:ConnectedAccount; email:EmailProvider; calendar:CalendarProvider }> {
  const { account, accessToken } = await accountToken(userId,accountId);
  const api: RequestApi = async (path,init = {}) => {
    const base = account.provider === "microsoft" ? "https://graph.microsoft.com" : path.startsWith("/gmail/") ? "https://gmail.googleapis.com" : "https://www.googleapis.com";
    const method = init.method || "GET", entity = path.split("?")[0];
    await connectionAudit(userId,account.provider,method,"started",entity,sourceMessageId);
    let response: Response;
    try { response = await fetch(`${base}${path}`, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(account.provider === "microsoft" ? { Prefer: 'IdType="ImmutableId", outlook.body-content-type="text", outlook.timezone="UTC"' } : {}), ...init.headers } }); }
    catch { await connectionAudit(userId,account.provider,method,"uncertain",entity,sourceMessageId); throw new Error("Connexion au fournisseur interrompue. Pour une action, vérifie son résultat avant de réessayer."); }
    if (!response.ok) {
      await connectionAudit(userId,account.provider,method,"failed",entity,sourceMessageId);
      if (response.status === 401 || response.status === 403) { await connectionStore().from("connected_accounts").update({ status: "reconnect" }).eq("id",accountId).eq("user_id",userId); throw new Error("Ton compte doit être reconnecté dans Réglages → Connexions."); }
      if (response.status === 412) throw new Error("Ce rendez-vous a changé depuis l’aperçu. Recharge-le avant de le modifier.");
      if (response.status === 429) throw new Error("Le fournisseur limite temporairement les demandes. Réessaie plus tard.");
      throw new Error(`Le fournisseur a refusé la demande (${response.status}). Aucun succès confirmé.`);
    }
    await connectionAudit(userId,account.provider,method,response.status === 202 ? "accepted" : "completed",entity,sourceMessageId);
    return response.status === 202 || response.status === 204 ? {} : await response.json();
  };
  return { account, email: account.provider === "google" ? new GoogleEmailProvider(api) : new MicrosoftEmailProvider(api,account.email), calendar: account.provider === "google" ? new GoogleCalendarProvider(api) : new MicrosoftCalendarProvider(api) };
}
