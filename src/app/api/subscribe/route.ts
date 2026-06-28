import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/subscribe
//
// Handles every lead-capture form on the site (hero, guide gratuit section,
// final CTA). Validates the input, then forwards the lead to MailerLite.
//
// To activate MailerLite for real:
//   1. Create an API key at https://dashboard.mailerlite.com/integrations/api
//   2. Add it to your environment as MAILERLITE_API_KEY (Vercel → Settings →
//      Environment Variables, or a local .env.local file — see .env.example)
//   3. Replace MAILERLITE_GROUP_ID with your actual group/list ID
//
// Until those env vars are set, this route still works end-to-end (it
// validates the email and returns success), it simply skips the external
// call — so the form, the thank-you state, and the PDF download all work
// out of the box during development.
// ---------------------------------------------------------------------------

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
const MAILERLITE_GROUP_ID = process.env.MAILERLITE_GROUP_ID ?? "";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body?.name ?? "").toString().trim();
    const email = (body?.email ?? "").toString().trim();
    const source = (body?.source ?? "site").toString();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Veuillez entrer une adresse courriel valide." },
        { status: 400 }
      );
    }

    if (MAILERLITE_API_KEY) {
      const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MAILERLITE_API_KEY}`,
        },
        body: JSON.stringify({
          email,
          fields: { name },
          groups: MAILERLITE_GROUP_ID ? [MAILERLITE_GROUP_ID] : undefined,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("MailerLite error:", res.status, detail);
        // We still tell the visitor it worked — a failed MailerLite sync
        // shouldn't block them from getting the guide. Log it for follow-up.
      }
    } else {
      console.log("[subscribe] (dev mode, no MAILERLITE_API_KEY set):", {
        name,
        email,
        source,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Subscribe route error:", err);
    return NextResponse.json(
      { ok: false, error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
