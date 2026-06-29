import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  // Full Next.js mode (not static export): required for the working
  // API routes (auth, /api/generate, Stripe checkout/webhook) below.
  // Deploy on Vercel (recommended) or Netlify with @netlify/plugin-nextjs.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

// withSentryConfig is a no-op-friendly wrapper: it only uploads source maps
// / sets up error tracing when SENTRY_AUTH_TOKEN + org/project are present
// (typically only in CI/production). Safe to leave wrapped at all times.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
