import * as Sentry from "@sentry/nextjs";

// Only initializes when a DSN is actually set — see .env.example. Without
// it, this is a harmless no-op so the app works fine before Sentry is
// configured.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
