export type Provider = "google" | "microsoft";
export type ConnectedAccount = { id: string; provider: Provider; email: string; status: string };
export type Email = { id: string; threadId: string; subject: string; from: string; replyTo: string; to: string[]; text: string; receivedAt: string; unread: boolean; sent: boolean; automated: boolean; internetMessageId?: string; references?: string; url?: string };
export type EmailQuery = { query?: string; since?: string; unread?: boolean; limit?: number };
export type OutgoingEmail = { to: string; subject: string; text: string; replyTo?: Email; operationId: string };
export type Attachment = { id: string; name: string; size: number; contentType: string };
export type CalendarEvent = { id: string; title: string; start: string; end: string; location: string; busy: boolean; url?: string; version?: string };
export type EventInput = { title: string; start: string; end: string; location: string; operationId: string };
export interface EmailProvider {
  listMessages(query: EmailQuery): Promise<Email[]>;
  searchMessages(query: EmailQuery): Promise<Email[]>;
  getMessage(id: string): Promise<Email>;
  getThread(id: string): Promise<Email[]>;
  createDraft(input: OutgoingEmail): Promise<string>;
  sendMessage(draftId: string): Promise<{ id: string; threadId?: string; accepted: boolean }>;
  replyToMessage(input: OutgoingEmail): Promise<string>;
  getAttachments(id: string): Promise<Attachment[]>;
}
export interface CalendarProvider {
  listEvents(start: string, end: string): Promise<CalendarEvent[]>;
  searchEvents(query: string, start: string, end: string): Promise<CalendarEvent[]>;
  getEvent(id: string): Promise<CalendarEvent>;
  checkAvailability(start: string, end: string, excludeId?: string): Promise<CalendarEvent[]>;
  createEvent(input: EventInput): Promise<CalendarEvent>;
  updateEvent(id: string, input: EventInput, version?: string): Promise<CalendarEvent>;
  deleteEvent(id: string, version?: string): Promise<void>;
}
