import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Build a Content-Security-Policy that admits what the stack actually needs:
// Next runtime (inline bootstrap), Supabase REST + Realtime, Sentry tunnel.
// We don't host any third-party iframes, so frame-ancestors stays 'none'.
const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : '*.supabase.co'

const CSP = [
  `default-src 'self'`,
  // 'unsafe-inline' / 'unsafe-eval' are still required by Next 16 client bootstrap.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://*.ingest.sentry.io https://*.sentry.io`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },

};

const hasSentry = !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)

const withIntlConfig = withNextIntl(nextConfig);

export default hasSentry
  ? withSentryConfig(withIntlConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      tunnelRoute: '/monitoring',
      disableLogger: true,
      // Sentry's modern API removes source maps from .next/static after upload.
      // Default is already true; making it explicit so a future config sweep
      // doesn't accidentally flip it.
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
    })
  : withIntlConfig;
