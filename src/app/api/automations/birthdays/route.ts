import { generateClientCommunication, type CommunicationTone } from "@/lib/client-communication/engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type BirthdayContact = {
  user_id: string;
  contact_id: string;
  contact_name: string;
  first_name: string;
  email: string | null;
  birth_date: string;
  consent: boolean;
  excluded: boolean;
};

type Tone = Extract<CommunicationTone, "chaleureux" | "professionnel" | "amical">;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validTones: Tone[] = ["chaleureux", "professionnel", "amical"];

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Bonjour";
}

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function dashboardUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

function birthdayMessage(contact: BirthdayContact, tone: Tone) {
  const output = generateClientCommunication({
    clientType: "les_deux",
    journeyStage: "anniversaire client",
    channel: "courriel",
    objective: "Souhaiter un bon anniversaire de façon humaine, relationnelle et non promotionnelle.",
    warmth: "tiède",
    context: { clientName: contact.contact_name, firstName: contact.first_name },
    tone,
    length: "courte",
  });
  return {
    subject: `Bonne fête ${contact.first_name} 🎉`,
    message: output.mainMessage,
  };
}

async function sendEmail(to: string, subject: string, message: string) {
  const mode = process.env.EMAIL_DELIVERY_MODE || "dry-run";
  if (mode !== "live") return { ok: true, providerId: "dry-run", simulated: true };

  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("EMAIL_API_KEY et EMAIL_FROM sont requis en mode live.");

  const response = await fetch(process.env.EMAIL_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text: message }),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || `Le fournisseur de courriel a répondu ${response.status}.`);
  return { ok: true, providerId: payload.id || "accepted", simulated: false };
}

async function recordHistory(input: {
  contact: BirthdayContact;
  destination: string;
  subject: string;
  message: string;
  status: "envoyé" | "échoué";
  error?: string;
  testMode: boolean;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("birthday_email_history").insert({
    user_id: input.contact.user_id,
    contact_id: input.contact.contact_id,
    contact_name: input.contact.contact_name,
    sent_at: new Date().toISOString(),
    type: "anniversaire",
    channel: "courriel",
    subject: input.subject,
    status: input.status,
    message: input.message,
    error: input.error || null,
    year: new Date().getFullYear(),
    test_mode: input.testMode,
    destination: input.destination,
  });
}

async function processContact(contact: BirthdayContact, destination: string, tone: Tone, testMode: boolean) {
  const { subject, message } = birthdayMessage(contact, tone);
  try {
    const delivery = await sendEmail(destination, subject, message);
    await recordHistory({ contact, destination, subject, message, status: "envoyé", testMode });
    return { contactId: contact.contact_id, contactName: contact.contact_name, destination, subject, message, status: "envoyé", ...delivery };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Erreur d’envoi inconnue.";
    await recordHistory({ contact, destination, subject, message, status: "échoué", error: reason, testMode });
    return { contactId: contact.contact_id, contactName: contact.contact_name, destination, subject, message, status: "échoué", error: reason };
  }
}

async function dailyRun() {
  if (!isConfigured()) throw new Error("Supabase n’est pas configuré.");
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const monthDay = now.toISOString().slice(5, 10);
  const year = now.getFullYear();
  const { data, error } = await admin.from("birthday_contacts").select("*");
  if (error) throw error;

  const contacts = (data || []) as BirthdayContact[];
  const birthdays = contacts.filter((contact) => contact.birth_date.slice(5, 10) === monthDay);
  const report = { birthdaysToday: birthdays.length, sent: 0, failed: 0, blocked: 0, missingEmails: 0, missingConsents: 0, results: [] as unknown[] };

  for (const contact of birthdays) {
    if (!contact.email || !EMAIL_PATTERN.test(contact.email)) {
      report.missingEmails += 1;
      report.blocked += 1;
      continue;
    }
    if (!contact.consent || contact.excluded) {
      report.missingConsents += 1;
      report.blocked += 1;
      continue;
    }
    const { data: existing } = await admin
      .from("birthday_email_history")
      .select("id")
      .eq("user_id", contact.user_id)
      .eq("contact_id", contact.contact_id)
      .eq("year", year)
      .eq("test_mode", false)
      .eq("status", "envoyé")
      .maybeSingle();
    if (existing) continue;

    const result = await processContact(contact, contact.email, "chaleureux", false);
    report.results.push(result);
    if (result.status === "envoyé") report.sent += 1;
    else report.failed += 1;
  }
  return report;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Accès cron non autorisé." }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ranAt: new Date().toISOString(), report: await dailyRun() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erreur cron." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await dashboardUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (!isConfigured()) return Response.json({ error: "Supabase n’est pas configuré." }, { status: 503 });

  const body = await request.json() as {
    action?: "sync" | "test" | "status";
    contacts?: Array<{ id: string; name: string; email?: string; birthDate?: string; consent: boolean; excluded: boolean }>;
    contact?: { id: string; name: string; email?: string; birthDate?: string; consent: boolean; excluded: boolean };
    testEmail?: string;
    tone?: Tone;
  };
  const admin = createSupabaseAdminClient();

  if (body.action === "sync") {
    const contacts = (body.contacts || []).filter((contact) => contact.birthDate).map((contact) => ({
      user_id: user.id,
      contact_id: contact.id,
      contact_name: contact.name,
      first_name: firstName(contact.name),
      email: contact.email || null,
      birth_date: contact.birthDate,
      consent: contact.consent,
      excluded: contact.excluded,
      updated_at: new Date().toISOString(),
    }));
    if (contacts.length) {
      const { error } = await admin.from("birthday_contacts").upsert(contacts, { onConflict: "user_id,contact_id" });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }
    const activeIds = new Set(contacts.map((contact) => contact.contact_id));
    const { data: existing } = await admin.from("birthday_contacts").select("contact_id").eq("user_id", user.id);
    const staleIds = (existing || []).map((contact) => String(contact.contact_id)).filter((id) => !activeIds.has(id));
    if (staleIds.length) {
      await Promise.all(staleIds.map((contactId) =>
        admin.from("birthday_contacts").delete().eq("user_id", user.id).eq("contact_id", contactId)
      ));
    }
    return Response.json({ ok: true, synced: contacts.length, removed: staleIds.length });
  }

  if (body.action === "test") {
    const allowedEmail = process.env.BIRTHDAY_TEST_EMAIL?.trim().toLowerCase();
    const requestedEmail = body.testEmail?.trim().toLowerCase();
    if (!allowedEmail || !requestedEmail || requestedEmail !== allowedEmail) {
      return Response.json({ error: "L’adresse doit correspondre exactement à BIRTHDAY_TEST_EMAIL." }, { status: 400 });
    }
    if (!body.contact) return Response.json({ error: "Choisissez un contact." }, { status: 400 });
    const tone = body.tone && validTones.includes(body.tone) ? body.tone : "chaleureux";
    const contact: BirthdayContact = {
      user_id: user.id,
      contact_id: body.contact.id,
      contact_name: body.contact.name,
      first_name: firstName(body.contact.name),
      email: body.contact.email || null,
      birth_date: new Date().toISOString().slice(0, 10),
      consent: body.contact.consent,
      excluded: body.contact.excluded,
    };
    const result = await processContact(contact, allowedEmail, tone, true);
    return Response.json({ ok: result.status === "envoyé", testMode: true, realContactUpdated: false, result });
  }

  const now = new Date();
  const todayDate = now.toISOString().slice(0, 10);
  const today = now.toISOString().slice(5, 10);
  const year = now.getFullYear();
  const [{ data: contacts }, { data: history }] = await Promise.all([
    admin.from("birthday_contacts").select("*").eq("user_id", user.id),
    admin.from("birthday_email_history").select("*").eq("user_id", user.id).eq("year", year),
  ]);
  const typedContacts = (contacts || []) as BirthdayContact[];
  const todayContacts = typedContacts.filter((contact) => contact.birth_date.slice(5, 10) === today);
  const sent = (history || []).filter((item) => !item.test_mode && item.status === "envoyé" && String(item.sent_at).slice(0, 10) === todayDate).length;
  const next = typedContacts
    .map((contact) => ({ ...contact, nextDate: nextBirthday(contact.birth_date) }))
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
  return Response.json({
    birthdaysToday: todayContacts.length,
    sent,
    blocked: todayContacts.filter((contact) => !contact.consent || contact.excluded || !contact.email || !EMAIL_PATTERN.test(contact.email)).length,
    missingEmails: todayContacts.filter((contact) => !contact.email || !EMAIL_PATTERN.test(contact.email)).length,
    missingConsents: todayContacts.filter((contact) => !contact.consent || contact.excluded).length,
    nextBirthday: next ? { name: next.contact_name, date: next.nextDate } : null,
    latest: (history || []).slice(0, 10),
  });
}

function nextBirthday(birthDate: string) {
  const now = new Date();
  const [month, day] = birthDate.slice(5, 10).split("-").map(Number);
  let candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    candidate = new Date(now.getFullYear() + 1, month - 1, day);
  }
  return candidate.toISOString().slice(0, 10);
}
